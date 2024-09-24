import { CacheManager } from '../../../cache/RedisCacheManager.js'
import { Match } from '@kh-openapi/index.js'
import MatchApiWrapper from '../../Khronos/matches/matchApiWrapper.js'
import { resolveTeam } from 'resolve-team'

export default class MatchCacheService {
	constructor(private cache: CacheManager) {}

	async requestMatches() {
		const data = await new MatchApiWrapper().getAllMatches()
		return data
	}

	async cacheMatches(matches: Match[]) {
		await this.cache.set('matches', matches, 86400)
		console.log({
			method: this.cacheMatches.name,
			message: 'Match Cache updated successfully.',
		})
	}

	async getMatches() {
		return await this.cache.get('matches')
	}

	async getMatch(matchid: string): Promise<Match | null> {
		const allMatches = await this.getMatches()
		if (!allMatches) {
			return null
		}
		const match = allMatches.find((match: Match) => match.id === matchid)
		if (!match) {
			return null
		}
		return match
	}

	async matchesByTeam(team: string) {
		const resolvedTeamName = await resolveTeam(team, { full: false })
		if (!resolvedTeamName) {
			throw new Error(`Unable to identify the sports team you specified`)
		}
		// Search match cache and identify matches that contain the team
		const matchCache = await this.getMatches()
		if (!matchCache) {
			throw new Error(`Unable to retrieve stored matches at this time.`)
		}
		const matches = matchCache.filter((match: Match) => {
			return (
				match.home_team === resolvedTeamName ||
				match.away_team === resolvedTeamName
			)
		})
		return matches
	}
}
