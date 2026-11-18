// ============================================================================
// Props Cron Scheduler - Initialize and manage prop caching jobs
// ============================================================================

import { logger } from '../logging/WinstonLogger.js'
import type { PropsCronService } from './PropsCronService.js'

/** A guild the Discord client is in, as the client sees it right now. */
export interface ServedGuild {
	id: string
	available: boolean
}

/**
 * Lists the guilds Pluto serves, or `null` while the Discord client is not
 * ready. Read on every run, so guilds joined or left since startup are picked
 * up without a restart.
 */
export type ServedGuildsProvider = () => ServedGuild[] | null

export interface ActivePropsRunSummary {
	cached: string[]
	skipped: Array<{ guildId: string; reason: 'guild_unavailable' }>
	failed: Array<{ guildId: string; error: string }>
}

/** Longest one guild's refresh may hold up the run before it counts as failed. */
export const GUILD_REFRESH_TIMEOUT_MS = 60 * 1000

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
	let timer: NodeJS.Timeout | undefined
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`timed out after ${ms}ms`)),
			ms,
		)
	})
	try {
		return await Promise.race([work, timeout])
	} finally {
		clearTimeout(timer)
	}
}

/**
 * Scheduler for prop caching jobs
 * Uses simple interval-based scheduling
 */
export class PropsCronScheduler {
	private cronService: PropsCronService
	private intervals: NodeJS.Timeout[] = []
	private readonly ALL_PROPS_INTERVAL = 60 * 60 * 1000 // 1 hour
	private readonly ACTIVE_PROPS_INTERVAL = 5 * 60 * 1000 // 5 minutes
	private isRunning = false
	private activeRunInFlight = false
	private readonly listServedGuilds: ServedGuildsProvider

	constructor(
		cronService: PropsCronService,
		listServedGuilds: ServedGuildsProvider,
	) {
		this.cronService = cronService
		this.listServedGuilds = listServedGuilds
	}

	/**
	 * Start all cron jobs
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			await logger.warn({
				message: 'Props cron scheduler is already running',
				metadata: {
					source: `${this.constructor.name}.${this.start.name}`,
				},
			})
			return
		}

		await logger.info({
			message: 'Starting props cron scheduler',
			metadata: { source: `${this.constructor.name}.${this.start.name}` },
		})

		// Run immediately on startup
		this.runAllPropsCachingJob().catch((error) => {
			logger.error({
				message: 'Failed to run initial all props caching job',
				metadata: {
					source: `${this.constructor.name}.${this.start.name}`,
					error:
						error instanceof Error ? error.message : String(error),
				},
			})
		})

		this.runActivePropsCachingJob('initial')

		// Schedule all props caching (every hour)
		const allPropsInterval = setInterval(() => {
			this.runAllPropsCachingJob().catch((error) => {
				logger.error({
					message: 'Failed to run scheduled all props caching job',
					metadata: {
						source: `${this.constructor.name}.${this.start.name}`,
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				})
			})
		}, this.ALL_PROPS_INTERVAL)

		this.intervals.push(allPropsInterval)

		// Schedule active props caching for every served guild (every 5 minutes)
		const activePropsInterval = setInterval(() => {
			this.runActivePropsCachingJob('scheduled')
		}, this.ACTIVE_PROPS_INTERVAL)

		this.intervals.push(activePropsInterval)

		this.isRunning = true

		await logger.info({
			message: 'Props cron scheduler started successfully',
			metadata: {
				source: `${this.constructor.name}.${this.start.name}`,
				allPropsInterval: `${this.ALL_PROPS_INTERVAL / 1000}s`,
				activePropsInterval: `${this.ACTIVE_PROPS_INTERVAL / 1000}s`,
			},
		})
	}

	/**
	 * Stop all cron jobs
	 */
	async stop(): Promise<void> {
		await logger.info({
			message: 'Stopping props cron scheduler',
			metadata: { source: `${this.constructor.name}.${this.stop.name}` },
		})

		for (const interval of this.intervals) {
			clearInterval(interval)
		}

		this.intervals = []
		this.isRunning = false

		await logger.info({
			message: 'Props cron scheduler stopped',
			metadata: { source: `${this.constructor.name}.${this.stop.name}` },
		})
	}

	/**
	 * Check if scheduler is running
	 */
	getStatus(): boolean {
		return this.isRunning
	}

	/**
	 * Run the all props caching job
	 */
	private async runAllPropsCachingJob(): Promise<void> {
		const startTime = Date.now()
		await logger.info({
			message: 'Running all props caching job',
			metadata: {
				source: `${this.constructor.name}.${this.runAllPropsCachingJob.name}`,
			},
		})

		await this.cronService.cacheAllProps()

		const duration = Date.now() - startTime
		await logger.info({
			message: 'All props caching job completed',
			metadata: {
				source: `${this.constructor.name}.${this.runAllPropsCachingJob.name}`,
				duration: `${duration}ms`,
			},
		})
	}

	/**
	 * Run the active props job without letting a rejection escape the timer.
	 */
	private runActivePropsCachingJob(trigger: 'initial' | 'scheduled'): void {
		this.cacheActivePropsForServedGuilds().catch((error) => {
			logger.error({
				message: `Failed to run ${trigger} active props caching job`,
				metadata: {
					source: `${this.constructor.name}.${this.start.name}`,
					error:
						error instanceof Error ? error.message : String(error),
				},
			})
		})
	}

	/**
	 * Refresh the active props cache for every guild Pluto serves. Each guild
	 * is cached on its own: one guild's failure is recorded and the run moves
	 * on to the next guild.
	 */
	async cacheActivePropsForServedGuilds(): Promise<ActivePropsRunSummary | null> {
		const source = `${this.constructor.name}.${this.cacheActivePropsForServedGuilds.name}`
		if (this.activeRunInFlight) {
			await logger.info({
				message: 'active_props_run_skipped',
				metadata: { source, reason: 'previous_run_in_progress' },
			})
			return null
		}

		this.activeRunInFlight = true
		const startTime = Date.now()
		const summary: ActivePropsRunSummary = {
			cached: [],
			skipped: [],
			failed: [],
		}

		try {
			const guilds = this.listServedGuilds()
			if (guilds === null) {
				await logger.info({
					message: 'active_props_run_skipped',
					metadata: { source, reason: 'client_not_ready' },
				})
				return summary
			}
			if (guilds.length === 0) {
				await logger.warn({
					message: 'active_props_run_skipped',
					metadata: { source, reason: 'no_served_guilds' },
				})
				return summary
			}

			for (const guild of guilds) {
				if (!guild.available) {
					summary.skipped.push({
						guildId: guild.id,
						reason: 'guild_unavailable',
					})
					await logger.warn({
						message: 'active_props_guild_skipped',
						metadata: {
							source,
							guildId: guild.id,
							reason: 'guild_unavailable',
						},
					})
					continue
				}

				try {
					// A stalled guild must not hold the run, or the overlap guard
					// would skip every later run.
					await withTimeout(
						this.cronService.cacheActivePropIds(guild.id),
						GUILD_REFRESH_TIMEOUT_MS,
					)
					summary.cached.push(guild.id)
				} catch (error) {
					summary.failed.push({
						guildId: guild.id,
						error:
							error instanceof Error
								? error.message
								: String(error),
					})
				}
			}

			const level = summary.failed.length > 0 ? 'warn' : 'info'
			await logger[level]({
				message: 'Active props caching job completed',
				metadata: {
					source,
					duration: `${Date.now() - startTime}ms`,
					guildCount: guilds.length,
					cachedCount: summary.cached.length,
					skippedCount: summary.skipped.length,
					failedGuildIds: summary.failed.map((f) => f.guildId),
				},
			})
			return summary
		} finally {
			this.activeRunInFlight = false
		}
	}
}
