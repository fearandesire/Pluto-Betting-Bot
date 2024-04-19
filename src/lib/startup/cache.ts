import MatchCacheService from '../../utils/api/routes/cache/MatchCacheService.js'
import { CacheManager } from '@pluto-redis'

/**
 * Store matches in cache on startup
 */
async function initCache() {
	const matchCacheService = new MatchCacheService(new CacheManager())
	const data = await matchCacheService.requestMatches()
	if (data?.matches && data.matches.length > 0) {
		await matchCacheService.cacheMatches(data.matches)
	} else {
		console.error(`Failed to cache matches | No matches were returned.`)
	}
}

initCache()
