import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { BetslipManager } from '../../utils/api/Khronos/bets/BetslipsManager.js'
import BetslipWrapper from '../../utils/api/Khronos/bets/betslip-wrapper.js'
import { BetsCacheService } from '../../utils/api/common/bets/BetsCacheService.js'
import { CacheManager } from '@pluto-redis'
import BettingValidation from '../../utils/betting/betting-validation'
import { ErrorEmbeds } from '../../utils/common/errors/global'

@ApplyOptions<Command.Options>({
	description: '🎲 Place a bet on a match',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.setDMPermission(false)
				.addStringOption((option) =>
					option
						.setName('team')
						.setDescription('The team you want to bet on')
						.setRequired(true),
				)
				.addIntegerOption((option) =>
					option
						.setName('amount')
						.setDescription('The amount you want to bet')
						.setRequired(true),
				),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply()
		const team = interaction.options.getString('team')!
		const amount = interaction.options.getInteger('amount')!
		const validator = new BettingValidation()
		const amountValid = validator.validateAmount(amount)
		if (!amountValid) {
			const errEmbed = ErrorEmbeds.betErr(`You must bet at least $1!.`)
			return interaction.editReply({ embeds: [errEmbed] })
		}
		return new BetslipManager(
			new BetslipWrapper(),
			new BetsCacheService(new CacheManager()),
		).initialize(
			interaction,
			interaction.user.id,
			team,
			amount,
			interaction.guildId!,
		)
	}
}
