import type { MatchDetailDto } from '@kh-openapi'
import { teamResolver } from 'resolve-team'
import type { CacheManager } from '../../../cache/cache-manager.js'
import MatchApiWrapper from '../../Khronos/matches/matchApiWrapper.js'

export default class MatchCacheService {
	constructor(private cache: CacheManager) {}

	async requestMatches() {
		const data = await new MatchApiWrapper().getAllMatches()
		return data
	}

	async cacheMatches(matches: MatchDetailDto[]) {
		await this.cache.set('matches', matches, 86400)
		console.log({
			method: this.cacheMatches.name,
			message: 'Match Cache updated successfully.',
		})
	}

	async getMatches(): Promise<MatchDetailDto[] | null> {
		const cachedMatches = await this.cache.get('matches')
		if (!cachedMatches || !Array.isArray(cachedMatches)) {
			return null
		}
		return cachedMatches
	}

	async getMatch(matchid: string): Promise<MatchDetailDto | null> {
		if (!matchid) {
			return null
		}
		const cachedMatches = await this.getMatches()
		const cachedMatch = cachedMatches?.find(
			(match: MatchDetailDto) => match.id === matchid,
		)
		if (cachedMatch) {
			return cachedMatch
		}

		const freshMatches = await this.refreshMatches()
		return (
			freshMatches?.find(
				(match: MatchDetailDto) => match.id === matchid,
			) ?? null
		)
	}

	private async refreshMatches(): Promise<MatchDetailDto[] | null> {
		try {
			const response = await this.requestMatches()
			const matches = response?.matches
			if (!matches || !matches.length) {
				return null
			}
			await this.cacheMatches(matches)
			return matches
		} catch (error) {
			console.error('Failed to refresh matches cache', error)
			return null
		}
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
