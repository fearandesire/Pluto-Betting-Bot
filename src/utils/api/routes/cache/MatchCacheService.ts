import { CacheManager } from '@pluto-redis'
import { Match } from '@khronos-index'

export default class MatchCacheService {
	constructor(private cache: CacheManager) {}

	async cacheMatches(matches: Match[]) {
		await this.cache.set('matches', matches, 86400)
		console.log({
			method: this.cacheMatches.name,
			message: 'Match Cache updated successfully.',
			data: matches,
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
}
