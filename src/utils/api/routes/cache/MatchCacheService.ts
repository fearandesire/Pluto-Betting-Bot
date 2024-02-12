import { CacheManager } from '@pluto-redis'
import { Matchup } from '../../interfaces/interfaces.js'

export default class MatchCacheService {
	constructor(private cache: CacheManager) {}

	async cacheMatches(matches: Matchup[]) {
		await this.cache.set('matches', matches, 86400)
		console.log({
			method: this.cacheMatches.name,
			message: 'Match Cache updated successfully.',
			data: matches,
		})
	}

	async getMatches() {
		const matches = await this.cache.get('matches')
		return matches
	}

	async getMatch(matchid: string): Promise<Matchup | null> {
		const allMatches = await this.getMatches()
		return allMatches.find((match: Matchup) => match.id === matchid) || null
	}
}
