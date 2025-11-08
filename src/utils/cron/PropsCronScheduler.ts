// ============================================================================
// Props Cron Scheduler - Initialize and manage prop caching jobs
// ============================================================================

import { logger } from '../logging/WinstonLogger.js'
import type { PropsCronService } from './PropsCronService.js'

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

	// Default guild ID - can be configured from env or config
	private readonly DEFAULT_GUILD_ID = process.env.GUILD_ID || ''

	constructor(cronService: PropsCronService) {
		this.cronService = cronService
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

		// Run immediately on startup (if guild ID is configured)
		if (this.DEFAULT_GUILD_ID) {
			this.runActivePropsCachingJob().catch((error) => {
				logger.error({
					message: 'Failed to run initial active props caching job',
					metadata: {
						source: `${this.constructor.name}.${this.start.name}`,
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				})
			})
		}

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

		// Schedule active props caching (every 5 minutes) if guild ID is configured
		if (this.DEFAULT_GUILD_ID) {
			const activePropsInterval = setInterval(() => {
				this.runActivePropsCachingJob().catch((error) => {
					logger.error({
						message:
							'Failed to run scheduled active props caching job',
						metadata: {
							source: `${this.constructor.name}.${this.start.name}`,
							error:
								error instanceof Error
									? error.message
									: String(error),
						},
					})
				})
			}, this.ACTIVE_PROPS_INTERVAL)

			this.intervals.push(activePropsInterval)
		} else {
			await logger.warn({
				message:
					'GUILD_ID not configured, active props caching job will not run automatically',
				metadata: {
					source: `${this.constructor.name}.${this.start.name}`,
				},
			})
		}

		this.isRunning = true

		await logger.info({
			message: 'Props cron scheduler started successfully',
			metadata: {
				source: `${this.constructor.name}.${this.start.name}`,
				allPropsInterval: `${this.ALL_PROPS_INTERVAL / 1000}s`,
				activePropsInterval: this.DEFAULT_GUILD_ID
					? `${this.ACTIVE_PROPS_INTERVAL / 1000}s`
					: 'disabled',
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
	 * Run the active props caching job
	 */
	private async runActivePropsCachingJob(): Promise<void> {
		const startTime = Date.now()
		await logger.info({
			message: 'Running active props caching job',
			metadata: {
				source: `${this.constructor.name}.${this.runActivePropsCachingJob.name}`,
				guildId: this.DEFAULT_GUILD_ID,
			},
		})

		await this.cronService.cacheActivePropIds(this.DEFAULT_GUILD_ID)

		const duration = Date.now() - startTime
		await logger.info({
			message: 'Active props caching job completed',
			metadata: {
				source: `${this.constructor.name}.${this.runActivePropsCachingJob.name}`,
				duration: `${duration}ms`,
			},
		})
	}
}
