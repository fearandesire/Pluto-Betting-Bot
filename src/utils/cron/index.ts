// ============================================================================
// Cron Job Initialization - Export and initialize cron services
// ============================================================================

import PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../api/Khronos/props/propsApiWrapper.js'
import { Cache } from '../cache/cache-manager.js'
import { logger } from '../logging/WinstonLogger.js'
import { ActivePropsService } from '../props/ActivePropsService.js'
import { PropsCacheService } from '../props/PropCacheService.js'
import { PropsCronScheduler } from './PropsCronScheduler.js'
import { PropsCronService } from './PropsCronService.js'

/**
 * Initialize and start the props cron scheduler
 * This should be called once during application startup
 */
export async function initializePropsCron(): Promise<PropsCronScheduler> {
	await logger.info({
		message: 'Initializing props cron scheduler',
		metadata: { source: 'initializePropsCron' },
	})

	// Get dependencies
	const cacheManager = Cache()
	const propsWrapper = new PropsApiWrapper()
	const predictionWrapper = new PredictionApiWrapper()

	// Initialize services
	const propsCacheService = new PropsCacheService(cacheManager)
	const activePropsService = new ActivePropsService(
		predictionWrapper,
		propsCacheService,
	)
	const cronService = new PropsCronService(
		propsWrapper,
		propsCacheService,
		activePropsService,
	)

	// Create and start scheduler
	const scheduler = new PropsCronScheduler(cronService)
	await scheduler.start()

	await logger.info({
		message: 'Props cron scheduler initialized and started',
		metadata: { source: 'initializePropsCron' },
	})

	return scheduler
}

// Export the scheduler instance for use in other parts of the app
let propsCronScheduler: PropsCronScheduler | null = null

/**
 * Get the singleton props cron scheduler instance
 */
export function getPropsCronScheduler(): PropsCronScheduler | null {
	return propsCronScheduler
}

/**
 * Set the props cron scheduler instance
 * Called by initializePropsCron
 */
export function setPropsCronScheduler(scheduler: PropsCronScheduler): void {
	propsCronScheduler = scheduler
}

// Auto-initialize when module is imported (after cache is ready)
// We use a slight delay to ensure all dependencies are loaded
setTimeout(async () => {
	try {
		const scheduler = await initializePropsCron()
		setPropsCronScheduler(scheduler)
	} catch (error) {
		await logger.error({
			message: 'Failed to initialize props cron scheduler',
			metadata: {
				source: 'initializePropsCron',
				error: error instanceof Error ? error.message : String(error),
			},
		})
	}
}, 5000) // 5 second delay to ensure all dependencies are ready
