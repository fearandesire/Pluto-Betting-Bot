// ============================================================================
// Cron Job Initialization - Export and initialize cron services
// ============================================================================

import env from '../../lib/startup/env.js'
import GuildWrapper from '../api/Khronos/guild/guild-wrapper.js'
import PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../api/Khronos/props/props-api-wrapper.js'
import RecapWrapper from '../api/Khronos/recap/recap-wrapper.js'
import { Cache } from '../cache/cache-manager.js'
import { logger } from '../logging/WinstonLogger.js'
import { ActivePropsService } from '../props/ActivePropsService.js'
import { PropsCacheService } from '../props/PropCacheService.js'
import { PropsCronScheduler } from './PropsCronScheduler.js'
import { PropsCronService } from './PropsCronService.js'
import { RecapCronScheduler } from './RecapCronScheduler.js'
import { RecapCronService } from './RecapCronService.js'

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

/**
 * Initialize the weekly recap digest. Recap remains opt-out by default but
 * only starts when at least one guild is configured and Khronos has shipped
 * the generated RecapApi client.
 */
export async function initializeRecapCron(): Promise<RecapCronScheduler | null> {
	const guildIds = (env.RECAP_GUILD_IDS || process.env.GUILD_ID || '')
		.split(',')
		.map((guildId) => guildId.trim())
		.filter(Boolean)

	if (
		env.USE_MOCK_DATA ||
		env.RECAP_ENABLED === false ||
		guildIds.length === 0
	) {
		await logger.info({
			message: 'weekly_recap_skipped',
			metadata: {
				reason: env.USE_MOCK_DATA
					? 'mock_data'
					: env.RECAP_ENABLED === false
						? 'disabled'
						: 'no_guilds_configured',
			},
		})
		return null
	}

	try {
		const service = new RecapCronService(
			new RecapWrapper(),
			Cache(),
			new GuildWrapper(),
			{
				guildIds,
				enabled: env.RECAP_ENABLED,
				channelId: env.RECAP_CHANNEL_ID,
				weekOffset: -1,
			},
		)
		const scheduler = new RecapCronScheduler(service, env.RECAP_CRON)
		scheduler.start()
		await logger.info({
			message: 'Weekly recap scheduler initialized and started',
			metadata: {
				guild_count: guildIds.length,
				expression: env.RECAP_CRON,
			},
		})
		return scheduler
	} catch (error) {
		await logger.error({
			message: 'weekly_recap_skipped',
			metadata: {
				reason: 'client_unavailable',
				error: error instanceof Error ? error.message : String(error),
			},
		})
		return null
	}
}

let recapCronScheduler: RecapCronScheduler | null = null

export function getRecapCronScheduler(): RecapCronScheduler | null {
	return recapCronScheduler
}

// Auto-initialize when module is imported (after cache is ready)
// We use a slight delay to ensure all dependencies are loaded
setTimeout(async () => {
	try {
		const scheduler = await initializePropsCron()
		setPropsCronScheduler(scheduler)
		const recapScheduler = await initializeRecapCron()
		recapCronScheduler = recapScheduler
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
