import Promise from 'bluebird'
import { Log } from '#config'
import {
	init_Cron_Chan_Scheduler,
	init_Cron_Heartbeat,
	init_Cron_Ranges,
} from '../scheduledModules.js'
import logClr from '#colorConsole'
import cronScheduleGames from '../../db/gameSchedule/cronScheduleGames.js'
import clearScheduled from '../../db/gameSchedule/clearScheduled.js'
import collectOdds from '../../api/collectOdds.js'

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
			await clearScheduled(),
			await init_Cron_Heartbeat(), // Start Cron for Heartbeats
			await cronScheduleGames(), // Check for any games that need to be scheduled now
			await init_Cron_Chan_Scheduler(), // Start Cron to schedule games daily
			await collectOdds(),
			await init_Cron_Ranges(), // Start Cron to check completed games
		])
	} catch (err) {
		Log.Red(err)
	}
}
