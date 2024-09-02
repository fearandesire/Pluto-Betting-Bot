import MatchCacheService from '../../utils/api/routes/cache/MatchCacheService.js'
import { CacheManager } from '@pluto-redis'

/**
 * Store matches in cache on startup
 */
async function initCache() {
	try {
		const matchCacheService = new MatchCacheService(new CacheManager())
		const data = await matchCacheService.requestMatches()
		if (data?.matches && data.matches.length > 0) {
			await matchCacheService.cacheMatches(data.matches)
		} else {
			console.error('Failed to cache matches | No matches were returned.')
		}
	} catch (error) {
		if (error instanceof Error) {
			if ('response' in error) {
				console.error(
					'Failed to cache matches | API error:',
					(error.response as Response).status,
					(error.response as Response).statusText,
				)
			} else {
				console.error('Failed to cache matches | Error:', error.message)
			}
		} else {
			console.error('Failed to cache matches | Unknown error:', error)
		}
	}
}

initCache()
