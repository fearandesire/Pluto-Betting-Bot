import Promise from 'bluebird'
import { Log } from '@pluto-core-config'
import logClr from '@pluto-internal-color-logger'
import {
	init_Cron_Completed,
	init_Cron_Chan_Scheduler,
	initMatchupHandling,
	queueMidnightCheck,
} from './scheduledModules.js'
import cronScheduleGames from '../db/gameSchedule/cronScheduleGames.js'
import clearScheduled from '../db/gameSchedule/clearScheduled.js'
import collectOdds from '../bot_res/betOps/collectOdds.js'
import { clearPendingBets } from './dailyModules_Utils.js'
import { handleBetMatchups } from '../bot_res/betOps/handleBetMatchups.js'

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
			await handleBetMatchups(),
			await clearScheduled(), // Clear Cached Scheduled Games
			await clearPendingBets(), // Clear Pending Bets - In this context, bets that have not been confirmed or cancelled.
			await collectOdds(), // Collect Odds on-start [Instant]
			await cronScheduleGames(), // Check for any games that need to be scheduled now (Game Channels) [Instant]
			await init_Cron_Chan_Scheduler(), // Start Cron to schedule games daily (Game Channels) [Daily]
			await init_Cron_Completed(true), // Start range generation on-startup [Instant]
			await queueMidnightCheck(), // Cron for checking games @ Midnight - 2 AM
			await initMatchupHandling(), // Start Cron to generate Cron Ranges & Check for completed games [Daily]
			// await init_Cron_Heartbeat(), // Start Cron for Heartbeats
		])
	} catch (err) {
		Log.Red(err)
		console.log(err)
	}
}
