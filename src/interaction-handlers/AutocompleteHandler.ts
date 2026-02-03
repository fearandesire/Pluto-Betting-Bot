import type { MatchDetailDto } from '@kh-openapi'
import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { AutocompleteInteraction } from 'discord.js'
import GuildWrapper from '../utils/api/Khronos/guild/guild-wrapper.js'
import MatchApiWrapper from '../utils/api/Khronos/matches/matchApiWrapper.js'
import MatchCacheService from '../utils/api/routes/cache/MatchCacheService.js'
import { CacheManager } from '../utils/cache/cache-manager.js'
import { DateManager } from '../utils/common/DateManager.js'
import StringUtils from '../utils/common/string-utils.js'
export class AutocompleteHandler extends InteractionHandler {
	private matchCacheService: MatchCacheService
	private stringUtils: StringUtils

	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
		matchCacheService: MatchCacheService = new MatchCacheService(
			new CacheManager(),
		),
		stringUtils: StringUtils = new StringUtils(),
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Autocomplete,
		})
		this.matchCacheService = matchCacheService
		this.stringUtils = stringUtils
	}

	public override async run(
		interaction: AutocompleteInteraction,
		result: InteractionHandler.ParseResult<this>,
	) {
		return interaction.respond(result)
	}

	public override async parse(interaction: AutocompleteInteraction) {
		if (interaction?.commandName !== 'bet') return this.none()
		const focusedOption = interaction.options.getFocused(true)

		// Fetch matches and guild data in parallel
		const [matches, guildData] = await Promise.all([
			this.matchRetrieval(),
			new GuildWrapper().getGuild(interaction.guildId),
		])

		if (!matches) return this.none()

		// Filter matches by sport
		const sportFilteredMatches = matches.filter((match: MatchDetailDto) =>
			match.sport?.includes(guildData.sport),
		)

		if (!sportFilteredMatches.length) return this.none()

		switch (focusedOption.name) {
			case 'match': {
				const currentInput = focusedOption.value as string
				const searchResult = sportFilteredMatches.filter(
					(match: MatchDetailDto) => {
						const homeTeam = match.home_team?.toLowerCase() ?? ''
						const awayTeam = match.away_team?.toLowerCase() ?? ''
						return (
							homeTeam.includes(currentInput.toLowerCase()) ||
							awayTeam.includes(currentInput.toLowerCase())
						)
					},
				)

				// Filter out matches with missing essential fields before mapping
				const validMatches = searchResult.filter(
					(match: MatchDetailDto) =>
						match.commence_time &&
						match.id &&
						match.home_team &&
						match.away_team,
				)

				return this.some(
					validMatches.map((match: MatchDetailDto) => ({
						name: `${this.stringUtils.getShortName(match.away_team!)} @ ${this.stringUtils.getShortName(match.home_team!)} | ${new DateManager().toMMDDYYYY(match.commence_time!)}`,
						value: match.id!,
					})),
				)
			}
			case 'team': {
				const matchSelection = interaction.options.getString(
					'match',
					false,
				)
				if (!matchSelection) {
					return this.none()
				}
				const selectedMatch = sportFilteredMatches.find(
					(match: MatchDetailDto) => match.id === matchSelection,
				)

				if (selectedMatch) {
					const teams = [
						selectedMatch.home_team,
						selectedMatch.away_team,
					].filter((team): team is string => team !== undefined)
					return this.some(
						teams.map((team) => {
							const normalizedTeam = team.trim()
							return {
								name: normalizedTeam,
								value: normalizedTeam,
							}
						}),
					)
				}
				return this.none()
			}
			default:
				return this.none()
		}
	}

	private async matchRetrieval(): Promise<MatchDetailDto[] | null> {
		try {
			const cachedMatches = await this.matchCacheService.getMatches()
			if (cachedMatches) return cachedMatches

			const freshMatches = await new MatchApiWrapper().getAllMatches()
			if (freshMatches) {
				await this.matchCacheService.cacheMatches(freshMatches.matches)
				return freshMatches.matches
			}

			return null
		} catch (error) {
			this.container.logger.error('Failed to fetch matches:', error)
			return null
		}
	}
}
