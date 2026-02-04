import type { MatchDetailDto } from '@kh-openapi'
import { type Job, Queue, Worker } from 'bullmq'
import MatchApiWrapper from '../../api/Khronos/matches/matchApiWrapper.js'
import { logger } from '../../logging/WinstonLogger.js'
import { CacheManager } from '../cache-manager.js'
import { REDIS_CONFIG } from '../data/config.js'

interface MatchRefreshJobData {
	reason?: string
}

interface MatchRefreshResult {
	success: boolean
	matchCount?: number
	nextRefreshAt?: number | null
	error?: string
}

export class MatchRefreshQueue {
	public queue: Queue<MatchRefreshJobData, MatchRefreshResult>
	private worker: Worker<MatchRefreshJobData, MatchRefreshResult>
	private static readonly QUEUE_NAME = 'match-refresh'
	private static readonly MAX_ATTEMPTS = 3
	private static readonly BACKOFF_DELAY = 1000
	private static readonly CACHE_TTL_SECONDS = 86400
	private static readonly REFRESH_LEAD_MS = 5 * 60 * 1000
	private static readonly DEFAULT_REFRESH_DELAY_MS = 5 * 60 * 1000

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
			async (job) => this.processJob(job),
			{
				connection,
				concurrency: 1,
			},
		)

		this.setupWorkerEvents()

		logger.info({
			message: 'Match refresh BullMQ initialized',
			source: 'MatchRefreshQueue:constructor',
		})
	}

	public async enqueueInitialRefresh(): Promise<void> {
		await this.enqueueRefresh('startup', 'initial')
	}

	public async enqueueRefresh(
		reason: string,
		jobId?: string,
		delayMs?: number,
	): Promise<void> {
		try {
			await this.queue.add(
				'refresh',
				{ reason },
				{
					jobId,
					delay: delayMs,
					removeOnComplete: true,
				},
			)
		} catch (error) {
			if (this.isDuplicateJobError(error)) {
				return
			}
			throw error
		}
	}

	private setupWorkerEvents(): void {
		this.worker.on(
			'completed',
			async (job: Job<MatchRefreshJobData, MatchRefreshResult>) => {
				const result = await job.returnvalue
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
						nextRefreshAt: result.nextRefreshAt,
					},
				})
			},
		)

		this.worker.on(
			'failed',
			(job: Job<MatchRefreshJobData>, error: Error) => {
				logger.error({
					message: 'Match refresh failed',
					source: 'MatchRefreshQueue:worker',
					data: {
						jobId: job.id,
						reason: job.data?.reason,
						error: error.message,
						attempts: job.attemptsMade,
					},
				})
			},
		)
	}

	private async processJob(
		job: Job<MatchRefreshJobData>,
	): Promise<MatchRefreshResult> {
		const cache = new CacheManager()

		try {
			const response = await new MatchApiWrapper().getAllMatches()
			const matches = response?.matches

			if (!Array.isArray(matches) || matches.length === 0) {
				throw new Error('No matches returned from API')
			}

			await cache.set(
				'matches',
				matches,
				MatchRefreshQueue.CACHE_TTL_SECONDS,
			)

			const nextRefreshAt = await this.scheduleNext(matches)

			return {
				success: true,
				matchCount: matches.length,
				nextRefreshAt,
			}
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

	private async scheduleNext(
		matches: MatchDetailDto[],
	): Promise<number | null> {
		const now = Date.now()
		const upcomingTimes = matches
			.map((match) => {
				if (!match.commence_time) return null
				const time = new Date(match.commence_time).getTime()
				return Number.isNaN(time) ? null : time
			})
			.filter((time): time is number => time !== null && time > now)
			.sort((a, b) => a - b)

		const nextMatchTime = upcomingTimes[0]
		const refreshAt = nextMatchTime
			? Math.max(nextMatchTime - MatchRefreshQueue.REFRESH_LEAD_MS, now)
			: now + MatchRefreshQueue.DEFAULT_REFRESH_DELAY_MS
		const delayMs = Math.max(refreshAt - now, 0)
		const jobId = `refresh-${refreshAt}`

		try {
			await this.enqueueRefresh('scheduled', jobId, delayMs)
		} catch (error) {
			logger.warn({
				message: 'Failed to schedule next match refresh',
				source: 'MatchRefreshQueue:scheduleNext',
				data: {
					jobId,
					error:
						error instanceof Error ? error.message : String(error),
				},
			})
		}

		return refreshAt
	}

	private isDuplicateJobError(error: unknown): boolean {
		const message = error instanceof Error ? error.message : String(error)
		return message.toLowerCase().includes('job') &&
			message.toLowerCase().includes('already exists')
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
