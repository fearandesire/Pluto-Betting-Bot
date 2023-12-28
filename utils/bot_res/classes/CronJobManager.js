import { schedule } from 'node-cron'
import { Log } from '@pluto-internal-logger'

export default class CronJobManager {
	constructor(cacheManager) {
		this.cacheManager = cacheManager
		this.keepAliveInterval = 300 // Time in seconds to reset the TTL
	}

	async scheduleJob(id, cronExpression, task) {
		const jobExists = await this.cacheManager().get(id)
		if (jobExists) {
			Log.Yellow(
				`Job with ID ${id} already scheduled. Skipping...`,
			)
			return
		}

		await schedule(cronExpression, task)
		const jobData = { id, cronExpression } // Store only the necessary details
		await this.cacheManager().set(
			id,
			jobData,
			this.keepAliveInterval,
		)
		await this.startJobKeepAlive(id)
		return Log.Blue(`Scheduled new job with ID ${id}`)
	}

	async resetJobTTL(id) {
		const job = await this.cacheManager().get(id)
		if (job) {
			await this.cacheManager().set(id, job)
		}
	}

	startJobKeepAlive(id) {
		setInterval(async () => {
			Log.Blue(`Resetting TTL for job ID: ${id}`)
			await this.resetJobTTL(id)
		}, this.keepAliveInterval * 1000) // Convert seconds to milliseconds
	}

	// Additional methods for job management (e.g., cancelJob, rescheduleJob) can be added here.
}
