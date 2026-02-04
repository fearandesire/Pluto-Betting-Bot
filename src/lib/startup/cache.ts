import { getMatchRefreshQueue } from '../../utils/cache/queue/match-refresh-queue.js'
import { logger } from '../../utils/logging/WinstonLogger.js'

/**
 * Store matches in cache on startup
 */
async function initCache() {
	try {
		await getMatchRefreshQueue().enqueueInitialRefresh()
	} catch (error) {
		if (error instanceof Error) {
			logger.error(error)
		}
	}
}

initCache()
