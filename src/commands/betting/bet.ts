import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { InteractionContextType } from 'discord.js';
import { teamResolver } from 'resolve-team';
import { BetslipManager } from '../../utils/api/Khronos/bets/BetslipsManager.js';
import BetslipWrapper from '../../utils/api/Khronos/bets/betslip-wrapper.js';
import { BetsCacheService } from '../../utils/api/common/bets/BetsCacheService.js';
import BettingValidation from '../../utils/betting/betting-validation.js';
import { CacheManager } from '../../utils/cache/cache-manager.js';
import { ErrorEmbeds } from '../../utils/common/errors/global.js';

@ApplyOptions<Command.Options>({
	description: '🎲 Place a bet on a match',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
					.addStringOption((option) =>
						option
							.setName('team')
							.setDescription('The team you want to bet on')
							.setRequired(true)
							.setAutocomplete(false),
					)
					.addIntegerOption((option) =>
						option
							.setName('amount')
							.setDescription('The amount you want to bet')
							.setRequired(true),
					)
					.addStringOption((option) =>
						option
							.setName('match')
							.setDescription('The match you want to bet on')
							.setRequired(false)
							.setAutocomplete(true),
					),
			{
				idHints: ['1022572274546651337'],
			},
		);
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();
		let team = interaction.options.getString('team', true);
		const amount = interaction.options.getInteger('amount', true);
		const validator = new BettingValidation();
		const amountValid = validator.validateAmount(amount);
		if (!amountValid) {
			const errEmbed = await ErrorEmbeds.betErr('You must bet at least $1!');
			return interaction.editReply({ embeds: [errEmbed] });
		}
		const matchSelection = interaction.options.getString('match', false);

		team = await this.identifyTeam(team);
		const betslipData = {
			team,
			amount,
			guild_id: interaction.guildId!,
			event_id: matchSelection,
			market_key: 'h2h',
		};
		return new BetslipManager(
			new BetslipWrapper(),
			new BetsCacheService(new CacheManager()),
		).initialize(interaction, interaction.user.id, betslipData);
	}

	private async identifyTeam(team: string) {
		const teamInfo = await teamResolver.resolve(team);
		return teamInfo;
	}
}
