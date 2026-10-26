import { type Job, Queue, Worker } from 'bullmq'
import { registerShutdownQueue } from '../../../lib/startup/shutdown-registry.js'
import MatchCacheService from '../../api/routes/cache/match-cache-service.js'
import { logger } from '../../logging/WinstonLogger.js'
import { CacheManager } from '../cache-manager.js'
import { REDIS_CONFIG } from '../data/config.js'

interface MatchRefreshJobData {
	reason?: string
}

interface MatchRefreshResult {
	success: boolean
	matchCount?: number
	error?: string
}

export class MatchRefreshQueue {
	public queue: Queue<MatchRefreshJobData, MatchRefreshResult>
	private worker: Worker<MatchRefreshJobData, MatchRefreshResult>
	private static readonly QUEUE_NAME = 'match-refresh'
	private static readonly MAX_ATTEMPTS = 3
	private static readonly BACKOFF_DELAY = 1000
	private static readonly SCHEDULER_ID = 'match-refresh-interval'
	private static readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000
	private static readonly DEFAULT_DRAIN_TIMEOUT_MS = 30_000
	private activeJobs = new Set<Promise<MatchRefreshResult>>()

	constructor() {
		const connection = REDIS_CONFIG

		this.queue = new Queue<MatchRefreshJobData, MatchRefreshResult>(
			MatchRefreshQueue.QUEUE_NAME,
			{
				connection,
				defaultJobOptions: {
					attempts: MatchRefreshQueue.MAX_ATTEMPTS,
					backoff: {
						type: 'exponential',
						delay: MatchRefreshQueue.BACKOFF_DELAY,
					},
					removeOnComplete: {
						age: 24 * 60 * 60,
						count: 5000,
					},
					removeOnFail: {
						age: 7 * 24 * 60 * 60,
						count: 10000,
					},
				},
			},
		)

		this.worker = new Worker<MatchRefreshJobData, MatchRefreshResult>(
			MatchRefreshQueue.QUEUE_NAME,
			async (job) => this.runJob(job),
			{
				connection,
				concurrency: 1,
			},
		)

		this.setupWorkerEvents()
		registerShutdownQueue(MatchRefreshQueue.QUEUE_NAME, this)

		logger.info({
			message: 'Match refresh BullMQ initialized',
			source: 'MatchRefreshQueue:constructor',
		})
	}

	/**
	 * Registers the recurring refresh and runs one immediately. The scheduler
	 * is upserted by a stable id, so restarts never stack duplicates, and a
	 * failed run never stops the next one.
	 */
	public async start(): Promise<void> {
		await this.queue.upsertJobScheduler(
			MatchRefreshQueue.SCHEDULER_ID,
			{ every: MatchRefreshQueue.REFRESH_INTERVAL_MS },
			{ name: 'refresh', data: { reason: 'scheduled' } },
		)
		await this.queue.add('refresh', { reason: 'startup' })
	}

	private setupWorkerEvents(): void {
		this.worker.on(
			'completed',
			(job: Job<MatchRefreshJobData, MatchRefreshResult>) => {
				const result = job.returnvalue
				if (!result?.success) {
					return
				}
				logger.info({
					message: 'Match refresh completed',
					source: 'MatchRefreshQueue:worker',
					data: {
						jobId: job.id,
						reason: job.data?.reason,
						matchCount: result.matchCount,
					},
				})
			},
		)

		this.worker.on(
			'failed',
			(
				job: Job<MatchRefreshJobData> | undefined,
				error: Error,
				prev: string,
			) => {
				if (!job) {
					logger.error({
						message: 'Match refresh failed (job unavailable)',
						source: 'MatchRefreshQueue:worker',
						data: { error: error.message, prev },
					})
					return
				}
				logger.error({
					message: 'Match refresh failed',
					source: 'MatchRefreshQueue:worker',
					data: {
						jobId: job.id,
						reason: job.data?.reason,
						error: error.message,
						attempts: job.attemptsMade,
						prev,
					},
				})
			},
		)
	}

	private async processJob(
		job: Job<MatchRefreshJobData>,
	): Promise<MatchRefreshResult> {
		try {
			const matchCount = await new MatchCacheService(
				new CacheManager(),
			).refreshMatches()
			return { success: true, matchCount }
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)

			logger.error({
				message: 'Match refresh error',
				source: 'MatchRefreshQueue:processJob',
				data: {
					error: errorMessage,
					attempts: job.attemptsMade,
				},
			})

			throw error
		}
	}

	private async runJob(
		job: Job<MatchRefreshJobData>,
	): Promise<MatchRefreshResult> {
		const activeJob = this.processJob(job)
		this.activeJobs.add(activeJob)
		try {
			return await activeJob
		} finally {
			this.activeJobs.delete(activeJob)
		}
	}

	public async close(
		drainTimeoutMs = MatchRefreshQueue.DEFAULT_DRAIN_TIMEOUT_MS,
	): Promise<boolean> {
		await this.worker.pause(true)
		const deadline = Date.now() + drainTimeoutMs
		let forceClose = false

		while (this.activeJobs.size > 0) {
			const remainingMs = deadline - Date.now()
			if (remainingMs <= 0) {
				forceClose = true
				break
			}
			let timeout: ReturnType<typeof setTimeout> | undefined
			await Promise.race([
				Promise.allSettled(this.activeJobs),
				new Promise<void>((resolve) => {
					timeout = setTimeout(resolve, remainingMs)
				}),
			])
			if (timeout) clearTimeout(timeout)
		}

		await this.worker.close(forceClose)
		await this.queue.close()
		return forceClose
	}
}

// Singleton instance - lazily initialized
let matchRefreshQueueInstance: MatchRefreshQueue | null = null

/**
 * Gets the MatchRefreshQueue singleton instance.
 * Creates the instance on first call (lazy initialization).
 * This ensures REDIS_CONFIG and other dependencies are initialized before construction.
 */
export function getMatchRefreshQueue(): MatchRefreshQueue {
	if (!matchRefreshQueueInstance) {
		matchRefreshQueueInstance = new MatchRefreshQueue()
	}
	return matchRefreshQueueInstance
}

/**
 * Explicitly initializes the MatchRefreshQueue singleton.
 * Call this during application startup after all dependencies are ready.
 * @returns The initialized MatchRefreshQueue instance
 */
export function initMatchRefreshQueue(): MatchRefreshQueue {
	return getMatchRefreshQueue()
}
