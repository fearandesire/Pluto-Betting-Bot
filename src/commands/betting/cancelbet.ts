import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'
import env from '../../lib/startup/env.js'
import { BetsCacheService } from '../../utils/api/common/bets/BetsCacheService.js'
import { BetslipManager } from '../../utils/api/Khronos/bets/BetslipsManager.js'
import BetslipWrapper from '../../utils/api/Khronos/bets/betslip-wrapper.js'
import { MyBetsPaginationService } from '../../utils/api/Khronos/bets/mybets-pagination.service.js'
import { CacheManager } from '../../utils/cache/cache-manager.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'

@ApplyOptions<Command.Options>({
	description:
		'❌ Cancel a bet you have placed via the bet ID. View your bet IDs with the /mybets command.',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.setContexts(InteractionContextType.Guild)
				.addIntegerOption((option) =>
					option //
						.setName('betid')
						.setDescription('The bet you are wanting to cancel')
						.setRequired(true),
				),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		if (env.MAINTENANCE_MODE) {
			const errEmbed = await ErrorEmbeds.maintenanceMode()
			return interaction.editReply({ embeds: [errEmbed] })
		}

		const userid = interaction.user.id
		const betId = interaction.options.getInteger('betid')!

		try {
			const betsData = await new MyBetsPaginationService().fetchUserBets(
				userid,
			)
			const matchingBet = betsData.pendingBets.find(
				(bet) => bet.betid === betId,
			)
			if (!matchingBet) {
				const errEmbed = await ErrorEmbeds.betErr(
					"We couldn't find an active (pending) bet with that ID. It may have already been cancelled or settled. Use **/mybets** to see your current bets.",
				)
				return interaction.editReply({ embeds: [errEmbed] })
			}

			return new BetslipManager(
				new BetslipWrapper(),
				new BetsCacheService(new CacheManager()),
			).cancelBet(interaction, userid, betId)
		} catch (error) {
			this.container.logger.error({
				message: 'Failed to fetch user bets for cancel',
				metadata: {
					source: this.chatInputRun.name,
					userId: interaction.user.id,
					betId,
					error:
						error instanceof Error ? error.message : String(error),
				},
			})

			const errEmb = await ErrorEmbeds.accountErr(
				'Unable to load your bets. Please try again later.',
			)
			return interaction.editReply({ embeds: [errEmb] })
		}
	}
}
