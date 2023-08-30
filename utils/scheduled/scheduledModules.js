import { Cron } from 'croner'
import { dmMe } from '#config'
import { getHeartbeat } from '../api/gameHeartbeat.js'
import logClr from '#colorConsole'
import cronScheduleGames from '../db/gameSchedule/cronScheduleGames.js'
import { checkCompleted, scheduledGames } from '#serverConf'

console.log(
	`Check Completed Games: ${checkCompleted}\nScheduled Games: ${scheduledGames}`,
)
/**
 * @function init_Cron_Heartbeat
 * Initialize Cron Job for Game Heartbeat
 */
export async function init_Cron_Heartbeat() {
	logClr({
		text: `Init Cron Job for Game Heartbeat`,
		color: `yellow`,
		status: `processing`,
	})
	// # Run Cron every 10 minutes to check for completed games & score
	// eslint-disable-next-line no-unused-vars
	const cron = new Cron(`${checkCompleted}`, async () => {
		try {
			await getHeartbeat()
		} catch (err) {
			await logClr({
				text: err,
				color: 'red',
				status: 'error',
			})
			await dmMe(
				`Error occured when checking heartbeat of games`,
			)
		}
	})
}

/**
 * @function init_Cron_Chan_Scheduler
 * Initialize Cron Job for Scheduling Game Channels
 */
export async function init_Cron_Chan_Scheduler() {
	logClr({
		text: `Init Cron Job for Scheduling Game Channels`,
		color: `yellow`,
		status: `processing`,
	})
	// # Run Cron every day at 2 AM to schedule new games
	// eslint-disable-next-line no-unused-vars
	const cron = new Cron(`${scheduledGames}`, async () => {
		await cronScheduleGames()
	})
}
