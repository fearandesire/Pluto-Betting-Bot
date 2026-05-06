import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'
import { teamResolver } from 'resolve-team'
import env from '../../lib/startup/env.js'
import { BetsCacheService } from '../../utils/api/common/bets/BetsCacheService.js'
import { BetslipManager } from '../../utils/api/Khronos/bets/BetslipsManager.js'
import BetslipWrapper from '../../utils/api/Khronos/bets/betslip-wrapper.js'
import MatchCacheService from '../../utils/api/routes/cache/match-cache-service.js'
import BettingValidation from '../../utils/betting/betting-validation.js'
import { CacheManager } from '../../utils/cache/cache-manager.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'

// Module-level singleton so cache state persists across command invocations
const matchCacheService = new MatchCacheService(new CacheManager())

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
							.setName('match')
							.setDescription('The match you want to bet on')
							.setRequired(true)
							.setAutocomplete(true),
					)
					.addStringOption((option) =>
						option
							.setName('team')
							.setDescription('The team you want to bet on')
							.setRequired(true)
							.setAutocomplete(true),
					)
					.addIntegerOption((option) =>
						option
							.setName('amount')
							.setDescription('The amount you want to bet')
							.setRequired(true),
					),
			{
				idHints: ['1022572274546651337'],
			},
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

		const matchSelection = interaction.options.getString('match', true)
		const teamInput = interaction.options.getString('team', true)
		const amount = interaction.options.getInteger('amount', true)
		const validator = new BettingValidation()
		const amountValid = validator.validateAmount(amount)
		if (!amountValid) {
			const errEmbed = await ErrorEmbeds.betErr(
				'You must bet at least $1!',
			)
			return interaction.editReply({ embeds: [errEmbed] })
		}
		// Strict autocomplete-only enforcement: the `match` value must be a
		// known match ID present in the cache. Anything the user typed by hand
		// that didn't come from the autocomplete dropdown won't match a real
		// ID and is rejected with a clear pick-from-the-list message.
		const selectedMatch = await matchCacheService.getMatch(matchSelection)
		if (
			!selectedMatch ||
			!selectedMatch.home_team ||
			!selectedMatch.away_team
		) {
			const errEmbed = await ErrorEmbeds.betErr(
				'Please choose a match from the autocomplete list — typed input is not accepted.',
			)
			return interaction.editReply({ embeds: [errEmbed] })
		}
		// Strict autocomplete-only enforcement for team. The autocomplete value
		// is the trimmed home_team or away_team string verbatim, so the input
		// must equal one of those exactly (after a defensive trim on each side).
		const trimmedTeamInput = teamInput.trim()
		const matchedTeam = [
			selectedMatch.home_team,
			selectedMatch.away_team,
		].find((team) => team.trim() === trimmedTeamInput)
		if (!matchedTeam) {
			const errEmbed = await ErrorEmbeds.betErr(
				'Please choose a team from the autocomplete list — typed input is not accepted.',
			)
			return interaction.editReply({ embeds: [errEmbed] })
		}

		const team = await this.identifyTeam(matchedTeam)
		const betslipData = {
			team,
			amount,
			guild_id: interaction.guildId!,
			event_id: matchSelection,
			market_key: 'h2h',
		}
		return new BetslipManager(
			new BetslipWrapper(),
			new BetsCacheService(new CacheManager()),
		).initialize(interaction, interaction.user.id, betslipData)
	}

	private async identifyTeam(team: string) {
		const teamInfo = await teamResolver.resolve(team)
		return teamInfo
	}
}
