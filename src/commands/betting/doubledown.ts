import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { BetslipManager } from '../../utils/api/Khronos/bets/BetslipsManager'
import BetslipWrapper from '../../utils/api/Khronos/bets/betslip-wrapper'
import { BetsCacheService } from '../../utils/api/common/bets/BetsCacheService'
import { CacheManager } from '@pluto-redis'
import { ApiErrorHandler } from '../../utils/api/Khronos/error-handling/ApiErrorHandler'
import { ApiModules } from '../../lib/interfaces/api/api.interface'
import { EmbedBuilder } from 'discord.js'
import embedColors from '../../lib/colorsConfig'

@ApplyOptions<Command.Options>({
	description: 'A basic slash command',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.setDMPermission(false)
				.addIntegerOption((option) =>
					option
						.setName(`betid`)
						.setDescription(`The ID of the bet to double down`)
						.setRequired(true),
				),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const betId = interaction.options.getInteger(`betid`, true)
		try {
			const betslipManager = new BetslipManager(
				new BetslipWrapper(),
				new BetsCacheService(new CacheManager()),
			)
			const newBetDetails = await betslipManager.doubleDown(
				interaction.user.id,
				betId,
			)
			const { newBetAmount, newProfit, newPayout, newBalance } =
				newBetDetails.betslip
			const modifiedBetEmbed = new EmbedBuilder()
				.setDescription(
					`## Double Down\n\n**Bet:** ${newBetAmount} | **Payout:** ${newPayout}\n**Profit:** ${newProfit}\n**Balance:** ${newBalance}`,
				)
				.setColor(embedColors.success)
				.setThumbnail(interaction.user.displayAvatarURL())
			return interaction.reply({ embeds: [modifiedBetEmbed] })
		} catch (err) {
			await new ApiErrorHandler().handle(
				interaction,
				err,
				ApiModules.betting,
			)
			return
		}
	}
}
