import MatchCacheService from '../../routes/cache/MatchCacheService.js'
import { CacheManager } from '@pluto-redis'

export default class MatchUtils extends MatchCacheService {
	constructor() {
		super(new CacheManager())
	}

	async identifyOpponent(matchId: string, selectedTeam: string) {
		const match = await this.getMatch(matchId)
		if (!match) {
			return null
		}
		if (match.home_team === selectedTeam) {
			return match.away_team
		}
		return match.home_team
	}
}
