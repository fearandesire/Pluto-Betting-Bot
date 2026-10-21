import { type Job, Queue, Worker } from 'bullmq'
import { registerShutdownQueue } from '../../../lib/startup/shutdown-registry.js'
import { createChannelPresentationService } from '../../guilds/channels/ChannelPresentationService.js'
import { logger } from '../../logging/WinstonLogger.js'
import {
	type ChannelPresentationUpdateV1,
	channelPresentationUpdateV1Schema,
} from '../data/channel-presentation-contract.js'
import { REDIS_CONFIG } from '../data/config.js'

export async function processPresentationJob(job: Pick<Job, 'data'>) {
	const update = channelPresentationUpdateV1Schema.parse(job.data)
	// Payload revision is only a wake-up hint: apply always reads the latest snapshot.
	await createChannelPresentationService().apply(
		update.guildId,
		update.gameId,
		false,
	)
}

export class ChannelPresentationQueue {
	readonly queue = new Queue<ChannelPresentationUpdateV1>(
		'channel-presentation-update',
		{ connection: REDIS_CONFIG },
	)
	private readonly activeJobs = new Set<Promise<void>>()
	private readonly worker = new Worker(
		'channel-presentation-update',
		async (job) => {
			const task = processPresentationJob(job)
			this.activeJobs.add(task)
			try {
				await task
			} finally {
				this.activeJobs.delete(task)
			}
		},
		{ connection: REDIS_CONFIG, concurrency: 10, lockDuration: 300_000 },
	)
	constructor() {
		this.worker.on('error', (error) =>
			logger.error({
				message: 'Presentation worker error',
				error: error.message,
			}),
		)
		registerShutdownQueue('channel-presentation-update', this)
	}
	async close(drainTimeoutMs = 30_000) {
		await this.worker.pause(true)
		let timeout: ReturnType<typeof setTimeout> | undefined
		let forced = false
		try {
			await Promise.race([
				Promise.allSettled(this.activeJobs),
				new Promise<void>((resolve) => {
					timeout = setTimeout(() => {
						forced = true
						resolve()
					}, drainTimeoutMs)
				}),
			])
		} finally {
			if (timeout) clearTimeout(timeout)
		}
		await this.worker.close(forced)
		await this.queue.close()
		return forced
	}
}
export const channelPresentationQueue = new ChannelPresentationQueue()
