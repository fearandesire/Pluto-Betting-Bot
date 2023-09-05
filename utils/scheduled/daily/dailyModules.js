import Promise from 'bluebird'
import { Log } from '#config'
import {
	init_Cron_Chan_Scheduler,
	init_Cron_Heartbeat,
	init_Cron_Ranges,
} from '../scheduledModules.js'
import logClr from '#colorConsole'
import cronScheduleGames from '../../db/gameSchedule/cronScheduleGames.js'

/**
 * @function dbDailyOps
 * Functions executed daily
 * Includes:
 * - Cron jobs for checking completed games & score
 * - Scheduling game channels
 * - Closing Bets
 */
export async function dbDailyOps() {
	logClr({
		text: `Starting daily operations`,
		color: `yellow`,
		status: `processing`,
	})
	try {
		await Promise.all([
			await init_Cron_Heartbeat(), // Start Cron for Heartbeats
			await cronScheduleGames(), // Check for any games that need to be scheduled now
			await init_Cron_Chan_Scheduler(), // Start Cron to schedule games daily
			await init_Cron_Ranges(), // Start Cron to check completed games
		])
	} catch (err) {
		Log.Red(err)
	}
}
