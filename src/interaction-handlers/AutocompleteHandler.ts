import type { MatchDetailDto } from '@kh-openapi'
import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { AutocompleteInteraction } from 'discord.js'
import { getGuildSport } from '../utils/api/Khronos/guild/guild-sport-cache.js'
import MatchApiWrapper from '../utils/api/Khronos/matches/matchApiWrapper.js'
import MatchCacheService from '../utils/api/routes/cache/match-cache-service.js'
import { getTeamChoicesForMatch } from '../utils/betting/autocomplete-choices.js'
import { CacheManager } from '../utils/cache/cache-manager.js'
import { DateManager } from '../utils/common/DateManager.js'
import StringUtils from '../utils/common/string-utils.js'

// Discord caps autocomplete responses at 25 results — slice before formatting
// so we never spend CPU on entries that would be discarded.
const MAX_AUTOCOMPLETE_RESULTS = 25

// `dateManager` is hoisted to module scope so a single instance is reused
// across every autocomplete call rather than being recreated per-keystroke.
const dateManager = new DateManager()

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

		// Both lookups are independent. The guild sport read is in-process on
		// cache hit (~0ms) — only a cold cache or the first call after TTL
		// expiry incurs the Khronos round-trip.
		const [matches, guildSport] = await Promise.all([
			this.matchRetrieval(),
			getGuildSport(interaction.guildId!),
		])

		if (!matches) return this.none()

		const sportFilteredMatches = matches.filter((match: MatchDetailDto) =>
			match.sport?.includes(guildSport),
		)

		if (!sportFilteredMatches.length) return this.none()

		switch (focusedOption.name) {
			case 'match': {
				const currentInput = (focusedOption.value as string)
					.toLowerCase()
					.trim()

				const choices: { name: string; value: string }[] = []
				for (const match of sportFilteredMatches) {
					if (
						!match.id ||
						!match.commence_time ||
						!match.home_team ||
						!match.away_team
					) {
						continue
					}
					if (currentInput.length > 0) {
						const home = match.home_team.toLowerCase()
						const away = match.away_team.toLowerCase()
						if (
							!home.includes(currentInput) &&
							!away.includes(currentInput)
						) {
							continue
						}
					}
					choices.push({
						name: `${this.stringUtils.getShortName(match.away_team)} @ ${this.stringUtils.getShortName(match.home_team)} | ${dateManager.toMMDDYYYY(match.commence_time)}`,
						value: match.id,
					})
					if (choices.length >= MAX_AUTOCOMPLETE_RESULTS) break
				}

				return this.some(choices)
			}
			case 'team': {
				const matchSelection = interaction.options.getString(
					'match',
					false,
				)
				const choices = getTeamChoicesForMatch(
					sportFilteredMatches,
					matchSelection ?? null,
				)
				if (choices.length === 0) return this.none()
				return this.some(choices)
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
