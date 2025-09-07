import { type Job, Queue, Worker } from 'bullmq';
import ChannelManager from '../../guilds/channels/ChannelManager.js';
import { logger } from '../../logging/WinstonLogger.js';
import { REDIS_CONFIG } from '../data/config.js';
import type {
	ChannelDeletionJobData,
	ChannelDeletionResult,
} from '../data/schemas.js';

export class ChannelDeletionQueue {
	public queue: Queue<ChannelDeletionJobData, ChannelDeletionResult>;
	private worker: Worker<ChannelDeletionJobData, ChannelDeletionResult>;
	private static readonly MAX_ATTEMPTS = 3;
	private static readonly BACKOFF_DELAY = 1000; // 1 second initial delay

	constructor() {
		const connection = REDIS_CONFIG;

		// Initialize queue with proper naming as per documentation
		this.queue = new Queue<ChannelDeletionJobData, ChannelDeletionResult>(
			'channel-deletion-queue',
			{
				connection,
				defaultJobOptions: {
					attempts: ChannelDeletionQueue.MAX_ATTEMPTS,
					backoff: {
						type: 'exponential',
						delay: ChannelDeletionQueue.BACKOFF_DELAY,
					},
					// Add job cleanup configuration
					removeOnComplete: {
						age: 24 * 3600, // Keep completed jobs for 24 hours
						count: 1000, // Keep last 1000 completed jobs
					},
					removeOnFail: {
						age: 7 * 24 * 3600, // Keep failed jobs for 7 days
						count: 5000, // Keep last 5000 failed jobs
					},
				},
			},
		);

		// Initialize worker with proper concurrency
		this.worker = new Worker<ChannelDeletionJobData, ChannelDeletionResult>(
			'channel-deletion-queue',
			async (job) => this.processJob(job),
			{ connection, concurrency: 15 },
		);

		this.setupWorkerEvents();

		logger.info({
			message: 'Channel deletion BullMQ initialized',
			source: 'ChannelDeletionQueue:constructor',
		});
	}

	private setupWorkerEvents(): void {
		this.worker.on(
			'completed',
			async (job: Job<ChannelDeletionJobData, ChannelDeletionResult>) => {
				const result = await job.returnvalue;
				if (result.success) {
					logger.info({
						message: 'Channel deletion successful',
						source: 'ChannelDeletionQueue:worker',
						data: {
							channelName: job.data.channelName,
							jobId: job.data.jobId,
						},
					});
				}
			},
		);

		this.worker.on(
			'failed',
			(job: Job<ChannelDeletionJobData>, error: Error) => {
				logger.error({
					message: 'Channel deletion failed',
					source: 'ChannelDeletionQueue:worker',
					data: {
						error: error.message,
						attempts: job.attemptsMade,
						channelName: job.data.channelName,
						jobId: job.data.jobId,
					},
				});
			},
		);
	}

	private async processJob(
		job: Job<ChannelDeletionJobData>,
	): Promise<ChannelDeletionResult> {
		const { channelName } = job.data;

		try {
			const channelManager = new ChannelManager();
			await channelManager.deleteChan(channelName);

			return {
				success: true,
				channelName,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			if (job.attemptsMade + 1 >= ChannelDeletionQueue.MAX_ATTEMPTS) {
				logger.error({
					message: `Channel deletion complete failure - Max attempts reached | Channel: ${channelName}`,
					source: 'ChannelDeletionQueue:worker',
					data: {
						error: errorMessage,
					},
				});
				// Mark as failed
				await job.moveToFailed(new Error(errorMessage), job.id, true);
			}

			return {
				success: false,
				channelName,
				error: errorMessage,
			};
		}
	}

	public async close(): Promise<void> {
		await this.queue.close();
		await this.worker.close();
	}
}

// Export singleton instance
export const channelDeletionQueue = new ChannelDeletionQueue();
