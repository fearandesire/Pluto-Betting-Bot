import Promise from 'bluebird'
import { Log } from '#config'
import {
	genRanges,
	init_Cron_Chan_Scheduler,
	init_Cron_Heartbeat,
	initMatchupHandling,
} from '../scheduledModules.js'
import logClr from '#colorConsole'
import cronScheduleGames from '../../db/gameSchedule/cronScheduleGames.js'
import clearScheduled from '../../db/gameSchedule/clearScheduled.js'
import collectOdds from '../../api/collectOdds.js'
import { clearPendingBets } from './dailyModules_Utils.js'

/**
 * @function dbDailyOps
 * Functions executed daily
 * Includes:
 *   Clear pending bets and prior scheduled games
 * - Cron jobs for checking completed games & score
 * - Scheduling game channels
 * - Processing bets for completed games
 */
export async function dbDailyOps() {
	logClr({
		text: `Starting daily operations`,
		color: `yellow`,
		status: `processing`,
	})
	try {
		await Promise.all([
			await clearScheduled(), // Clear Cached Scheduled Games
			await clearPendingBets(), // Clear Pending Bets
			await init_Cron_Heartbeat(), // Start Cron for Heartbeats
			await cronScheduleGames(), // Check for any games that need to be scheduled now (Game Channels)
			await init_Cron_Chan_Scheduler(), // Start Cron to schedule games daily (Game Channels)
			await collectOdds(), // Collect Odds on-start
			await genRanges(), // Generate Cron Ranges on-start as well
			await initMatchupHandling(), // Start Cron to generate Cron Ranges & Check for completed games
		])
	} catch (err) {
		Log.Red(err)
	}
}
