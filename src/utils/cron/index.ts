// ============================================================================
// Cron Job Initialization - Export and initialize cron services
// ============================================================================

import env from '../../lib/startup/env.js'
import GuildWrapper from '../api/Khronos/guild/guild-wrapper.js'
import LeaderboardWrapper from '../api/Khronos/leaderboard/leaderboard-wrapper.js'
import PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../api/Khronos/props/props-api-wrapper.js'
import RecapWrapper from '../api/Khronos/recap/recap-wrapper.js'
import { Cache } from '../cache/cache-manager.js'
import { logger } from '../logging/WinstonLogger.js'
import { ActivePropsService } from '../props/ActivePropsService.js'
import { PropsCacheService } from '../props/PropCacheService.js'
import { LeaderboardAutoPostService } from './LeaderboardAutoPostService.js'
import { PeriodWinnersCronService } from './PeriodWinnersCronService.js'
import { PropsCronScheduler } from './PropsCronScheduler.js'
import { PropsCronService } from './PropsCronService.js'
import { RecapCronScheduler } from './RecapCronScheduler.js'
import { RecapCronService } from './RecapCronService.js'
import { resolveRecapTargets } from './recap-targets.js'

export { resolveRecapTargets } from './recap-targets.js'

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
	const envGuildIds = (env.RECAP_GUILD_IDS || process.env.GUILD_ID || '')
		.split(',')
		.map((guildId) => guildId.trim())
		.filter(Boolean)

	if (env.USE_MOCK_DATA || env.RECAP_ENABLED === false) {
		await logger.info({
			message: 'weekly_recap_skipped',
			metadata: {
				reason: env.USE_MOCK_DATA ? 'mock_data' : 'disabled',
			},
		})
		return null
	}

	try {
		const recapApi = new RecapWrapper()
		const { targets, source } = await resolveRecapTargets(
			recapApi,
			envGuildIds,
			env.RECAP_CHANNEL_ID,
			env.RECAP_NBA_ENABLED,
		)

		if (targets.length === 0) {
			await logger.info({
				message: 'weekly_recap_skipped',
				metadata: { reason: 'no_guilds_configured', source },
			})
			return null
		}

		const service = new RecapCronService(
			recapApi,
			Cache(),
			new GuildWrapper(),
			{
				targets,
				enabled: true,
				weekOffset: -1,
			},
		)
		const scheduler = new RecapCronScheduler(service, env.RECAP_CRON)
		scheduler.start()
		await logger.info({
			message: 'Weekly recap scheduler initialized and started',
			metadata: {
				guild_count: targets.length,
				source,
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

/**
 * Initialize the opt-in period winners posts (weekly and monthly). Inert
 * unless PERIOD_WINNERS_ENABLED is set; NBA additionally needs
 * RECAP_NBA_ENABLED. Reuses the recap scheduler for its UTC cron matching and
 * restart catch-up.
 */
export async function initializePeriodWinnersCron(): Promise<
	RecapCronScheduler[]
> {
	const guildIds = (env.RECAP_GUILD_IDS || process.env.GUILD_ID || '')
		.split(',')
		.map((guildId) => guildId.trim())
		.filter(Boolean)

	if (
		env.USE_MOCK_DATA ||
		!env.PERIOD_WINNERS_ENABLED ||
		guildIds.length === 0
	) {
		await logger.info({
			message: 'period_winners_skipped',
			metadata: {
				reason: env.USE_MOCK_DATA
					? 'mock_data'
					: !env.PERIOD_WINNERS_ENABLED
						? 'disabled'
						: 'no_guilds_configured',
			},
		})
		return []
	}

	try {
		const service = new PeriodWinnersCronService(
			new RecapWrapper(),
			Cache(),
			new GuildWrapper(),
			{
				guildIds,
				enabled: true,
				channelId: env.RECAP_CHANNEL_ID,
				sports: env.RECAP_NBA_ENABLED ? ['nfl', 'nba'] : ['nfl'],
			},
		)
		const schedulers = (
			[
				['weekly', env.PERIOD_WINNERS_WEEKLY_CRON],
				['monthly', env.PERIOD_WINNERS_MONTHLY_CRON],
			] as const
		).map(([period, expression]) => {
			const scheduler = new RecapCronScheduler(
				{
					runWeeklyRecap: (now, allowProcessingReclaim) =>
						service.runPeriodWinners(
							period,
							allowProcessingReclaim,
						),
				},
				expression,
				undefined,
				`PERIOD_WINNERS_${period.toUpperCase()}_CRON`,
			)
			scheduler.start()
			return scheduler
		})
		await logger.info({
			message: 'Period winners schedulers initialized and started',
			metadata: {
				guild_count: guildIds.length,
				nba: env.RECAP_NBA_ENABLED,
			},
		})
		return schedulers
	} catch (error) {
		await logger.error({
			message: 'period_winners_skipped',
			metadata: {
				reason: 'client_unavailable',
				error: error instanceof Error ? error.message : String(error),
			},
		})
		return []
	}
}

// Sunday evening still inside the current Eastern week.
const WEEKLY_LEADERBOARD_CRON = '0 23 * * 0'
// Fires on the last possible days; the service posts only on the real last
// Eastern day so the board covers the whole month.
const MONTHLY_LEADERBOARD_CRON = '0 23 28-31 * *'

/**
 * Auto-posts the props prediction leaderboard for the current Eastern week and
 * month. Both toggles and the channel come from Khronos `guild_recap_settings`;
 * there is no environment-driven fallback because these posts are new.
 */
export async function initializeLeaderboardAutoPostCrons(): Promise<
	RecapCronScheduler[]
> {
	try {
		const settings = await new RecapWrapper().getSettings()
		const targetsFor = (
			flag: 'weekly_leaderboard_enabled' | 'monthly_leaderboard_enabled',
		) =>
			settings
				.filter((row) => row[flag] && row.channel_id)
				.map((row) => ({
					guildId: row.guild_id,
					channelId: row.channel_id as string,
				}))

		const weeklyTargets = targetsFor('weekly_leaderboard_enabled')
		const monthlyTargets = targetsFor('monthly_leaderboard_enabled')
		if (weeklyTargets.length === 0 && monthlyTargets.length === 0) {
			return []
		}

		const leaderboardApi = new LeaderboardWrapper()
		const schedulerFor = (
			targets: Array<{ guildId: string; channelId: string }>,
			period: 'week' | 'month',
			expression: string,
		) => {
			const service = new LeaderboardAutoPostService(
				leaderboardApi,
				Cache(),
				new GuildWrapper(),
				{ targets, period },
			)
			const scheduler = new RecapCronScheduler(service, expression)
			scheduler.start()
			return scheduler
		}

		const schedulers: RecapCronScheduler[] = []
		if (weeklyTargets.length > 0) {
			schedulers.push(
				schedulerFor(weeklyTargets, 'week', WEEKLY_LEADERBOARD_CRON),
			)
		}
		if (monthlyTargets.length > 0) {
			schedulers.push(
				schedulerFor(monthlyTargets, 'month', MONTHLY_LEADERBOARD_CRON),
			)
		}
		await logger.info({
			message: 'Leaderboard autopost schedulers initialized',
			metadata: {
				weekly_guilds: weeklyTargets.length,
				monthly_guilds: monthlyTargets.length,
			},
		})
		return schedulers
	} catch (error) {
		await logger.warn({
			message: 'leaderboard_post_skipped',
			metadata: {
				reason: 'settings_unavailable',
				error: error instanceof Error ? error.message : String(error),
			},
		})
		return []
	}
}

let recapCronScheduler: RecapCronScheduler | null = null
let periodWinnersSchedulers: RecapCronScheduler[] = []
let leaderboardSchedulers: RecapCronScheduler[] = []

export function getPeriodWinnersSchedulers(): RecapCronScheduler[] {
	return periodWinnersSchedulers
}

export function getRecapCronScheduler(): RecapCronScheduler | null {
	return recapCronScheduler
}

export function getLeaderboardSchedulers(): RecapCronScheduler[] {
	return leaderboardSchedulers
}

// Auto-initialize when module is imported (after cache is ready)
// We use a slight delay to ensure all dependencies are loaded
setTimeout(async () => {
	try {
		const scheduler = await initializePropsCron()
		setPropsCronScheduler(scheduler)
		const recapScheduler = await initializeRecapCron()
		recapCronScheduler = recapScheduler
		periodWinnersSchedulers = await initializePeriodWinnersCron()
		leaderboardSchedulers = await initializeLeaderboardAutoPostCrons()
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
