import { createRequire } from 'module'
import Promise from 'bluebird'
import { Log, SCHEDULE_TIMER } from '#config'
import { removeAllMatchups } from '#utilMatchups/removeAllMatchups'
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
@module scheduleReq 
Executed daily, setup a sequence of Cron Jobs to call the API and collect odds for games.
The timer is based on weekly schedule rotation for NFL, and daily for NBA [Regular Season]
*/

export async function scheduleReq() {
	cron.schedule(
		`${SCHEDULE_TIMER}`,
		async () => {
			await debugLog.info(
				labelMsg(
					`scheduleReq`,
					`Closing any existing bets before collecting new odds.`,
				),
			)

			await handleBetMatchups().then(async () => {
				await removeAllMatchups().then(async () => {
					await collectOdds()
				})
			})
		},
		{ timezone: 'America/New_York' },
	)
}

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
