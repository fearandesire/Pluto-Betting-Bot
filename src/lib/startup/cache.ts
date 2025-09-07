import MatchCacheService from '../../utils/api/routes/cache/MatchCacheService.js';
import { CacheManager } from '../../utils/cache/cache-manager.js';
import { logger } from '../../utils/logging/WinstonLogger.js';
/**
 * Store matches in cache on startup
 */
async function initCache() {
	try {
		const matchCacheService = new MatchCacheService(new CacheManager());
		const data = await matchCacheService.requestMatches();
		if (data?.matches && data.matches.length > 0) {
			await matchCacheService.cacheMatches(data.matches);
		} else {
			logger.error('Failed to cache matches | No matches were returned.');
		}
	} catch (error) {
		if (error instanceof Error) {
				logger.error(error);
			}  
		}
	}

initCache();
