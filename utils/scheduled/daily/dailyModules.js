import { createRequire } from 'module'
import Promise from 'bluebird'
import { Log, SCHEDULE_TIMER } from '#config'
import collectOdds from '../../api/collectOdds.js'
import { debugLog, labelMsg } from '../../logging.js'
import { handleBetMatchups } from '../../api/handleBetMatchups.js'
import {
	init_Cron_Chan_Scheduler,
	init_Cron_Heartbeat,
} from '../scheduledModules.js'
import logClr from '#colorConsole'
import cronScheduleGames from '../../db/gameSchedule/cronScheduleGames.js'

const require = createRequire(import.meta.url)
const cron = require('node-cron')

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
		])
	} catch (err) {
		Log.Red(err)
	}
}
