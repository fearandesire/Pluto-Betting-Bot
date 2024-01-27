import { schedule } from 'node-cron'
import { Log } from '@pluto-internal-logger'

export default class CronJobManager {
	async scheduleJob(id, cronExpression, task) {
		const jobExists = await this.cacheManager().get(id)
		if (jobExists) {
			Log.Yellow(
				`Unable to add to schedule: Job with ID ${id} already scheduled. .`,
			)
			return
		}

		await schedule(cronExpression, task)
	}
}
