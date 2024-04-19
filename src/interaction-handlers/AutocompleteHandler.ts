import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { AutocompleteInteraction } from 'discord.js'
import MatchCacheService from '../utils/api/routes/cache/MatchCacheService.js'
import { CacheManager } from '@pluto-redis'
import { Match } from '@khronos-index'

export class AutocompleteHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Autocomplete,
		})
	}

	public override async run(
		interaction: AutocompleteInteraction,
		result: InteractionHandler.ParseResult<this>,
	) {
		return interaction.respond(result)
	}

	public override async parse(interaction: AutocompleteInteraction) {
		if (interaction.commandName !== `bet`) return this.none()
		// Get the focussed (current) option
		const focusedOption = interaction.options.getFocused(true)
		// Ensure that the option name is one that can be autocompleted, or return none if not.
		switch (focusedOption.name) {
			case 'match': {
				const matchCacheService = new MatchCacheService(
					new CacheManager(),
				)
				const currentInput = focusedOption.value as string
				const matches = await matchCacheService.getMatches()
				// Search for matches that contain the current input
				const searchResult = matches.filter((match: Match) => {
					return (
						match.home_team
							.toLowerCase()
							.includes(currentInput.toLowerCase()) ||
						match.away_team
							.toLowerCase()
							.includes(currentInput.toLowerCase())
					)
				})
				// Map the search results to the structure required for Autocomplete
				return this.some(
					searchResult.map((match: Match) => ({
						name: `${match.away_team} at ${match.home_team} | ${match.dateofmatchup}`,
						value: match.id,
					})),
				)
			}
			default:
				return this.none()
		}
	}
}
