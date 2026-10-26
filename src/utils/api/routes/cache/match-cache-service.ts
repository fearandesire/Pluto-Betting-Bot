import type { MatchDetailDto } from '@pluto-khronos/api-client'
import { teamResolver } from 'resolve-team'
import type { CacheManager } from '../../../cache/cache-manager.js'
import { logger } from '../../../logging/WinstonLogger.js'
import MatchApiWrapper from '../../Khronos/matches/matchApiWrapper.js'

// The refresh scheduler rewrites this key every few minutes, so the TTL only
// bounds how long a snapshot survives when refreshes stop arriving.
export const MATCH_CACHE_TTL_SECONDS = 3 * 60 * 60

export default class MatchCacheService {
	constructor(private cache: CacheManager) {}

	async requestMatches() {
		const data = await new MatchApiWrapper().getAllMatches()
		return data
	}

	async cacheMatches(matches: MatchDetailDto[]) {
		await this.cache.set('matches', matches, MATCH_CACHE_TTL_SECONDS)
		logger.info({
			message: 'Match Cache updated successfully.',
			source: 'MatchCacheService:cacheMatches',
			data: { matchCount: matches.length },
		})
	}

	/**
	 * Replaces the cached matches with Khronos' current list. An empty list
	 * leaves the existing snapshot in place: Khronos returns `[]` both in the
	 * off-season and when its Goracle lookups fail, and the TTL retires any
	 * snapshot that is genuinely stale.
	 * @returns the number of matches cached
	 */
	async refreshMatches(): Promise<number> {
		const response = await this.requestMatches()
		const matches = response?.matches
		if (!Array.isArray(matches) || matches.length === 0) return 0
		await this.cacheMatches(matches)
		return matches.length
	}

	async getMatches(): Promise<MatchDetailDto[] | null> {
		const cachedMatches = await this.cache.get('matches')
		if (
			!cachedMatches ||
			!Array.isArray(cachedMatches) ||
			cachedMatches.length === 0
		) {
			return null
		}
		return cachedMatches
	}

	async getMatch(matchid: string): Promise<MatchDetailDto | null> {
		if (!matchid) {
			return null
		}
		const cachedMatches = await this.getMatches()
		return (
			cachedMatches?.find(
				(match: MatchDetailDto) => match.id === matchid,
			) ?? null
		)
	}

	async matchesByTeam(team: string) {
		const resolvedTeamName = await teamResolver.resolve(team, {
			full: false,
		})
		if (!resolvedTeamName) {
			throw new Error('Unable to identify the sports team you specified')
		}
		// Search match cache and identify matches that contain the team
		const matchCache = await this.getMatches()
		if (!matchCache) {
			throw new Error('Unable to retrieve stored matches at this time.')
		}
		const matches = matchCache.filter((match: MatchDetailDto) => {
			return (
				match.home_team === resolvedTeamName ||
				match.away_team === resolvedTeamName
			)
		})
		return matches
	}
}
