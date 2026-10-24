import { getMatchRefreshQueue } from '../../utils/cache/queue/match-refresh-queue.js'
import { logger } from '../../utils/logging/WinstonLogger.js'

/**
 * Start the recurring match-cache refresh
 */
async function initCache() {
	try {
		await getMatchRefreshQueue().start()
	} catch (error) {
		if (error instanceof Error) {
			logger.error(error)
		}
	}
}

initCache()
