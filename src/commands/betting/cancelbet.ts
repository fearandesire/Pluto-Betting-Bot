import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'
import env from '../../lib/startup/env.js'
import { BetsCacheService } from '../../utils/api/common/bets/BetsCacheService.js'
import { BetslipManager } from '../../utils/api/Khronos/bets/BetslipsManager.js'
import BetslipWrapper from '../../utils/api/Khronos/bets/betslip-wrapper.js'
import { CacheManager } from '../../utils/cache/cache-manager.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'
import { MyBetsPaginationService } from '../../utils/api/Khronos/bets/mybets-pagination.service.js'

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

		// New: Check Betid in Active Bets for User
		const bets = await new MyBetsPaginationService().fetchUserBets(userid)?.pendingbets
		if (!bets || !bets.length)
			return interaction.editReply({content: 'You have no placed bets to cancel.'})
		let found = false
		for (const bet of bets)
			if (betId === bet.betid) {
				found = true
				break
			}
		if (!found)
			return interaction.editReply({content: 'Could not find betid in your current bets.'})
		
		return new BetslipManager(
			new BetslipWrapper(),
			new BetsCacheService(new CacheManager()),
		).cancelBet(interaction, userid, betId)
	}
}
