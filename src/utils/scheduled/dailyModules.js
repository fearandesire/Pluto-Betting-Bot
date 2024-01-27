import { Log } from '@pluto-core-config'
import logClr from '@pluto-internal-color-logger'
// import // init_Cron_Completed,
// initMatchupHandling,
// init_Cron_Heartbeat,
// queueMidnightCheck,
// './scheduledModules.js'
import { clearPendingBets } from './dailyModules_Utils.js'
import { handleBetMatchups } from '../bot_res/betOps/handleBetMatchups.js'

/**
 * @function dbDailyOps
 * Functions executed daily / Init/Startup Operations
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
			Log.Yellow(`Completed handleBetMatchups`),
			await clearPendingBets(), // Clear Pending Bets - In this context, bets that have not been confirmed or cancelled.
			Log.Yellow(`Completed clearPendingBets`),
			//			await collectOdds(), // Collect Odds on-start [Instant]
			Log.Yellow(`Completed collectOdds`),
			// await new ChannelManager(
			// 	server_ID,
			// ).syncScheduled(),
			Log.Yellow(`Completed syncScheduled`),
			// await new GameScheduler().init(), // Check for any games that need to be scheduled now (Game Channels) [Instant]
			// await init_Cron_Chan_Scheduler(), // Start Cron to schedule games daily (Game Channels) [Daily]
			// await queueMidnightCheck(), // Cron for checking games @ Midnight - 2 AM
			// await initMatchupHandling(), // Start Cron to generate Cron Ranges & Check for completed games [Daily]
			// Log.Green(`Completed init modules`),
			// await init_Cron_Heartbeat(), // Start Cron for Heartbeats
		])
	} catch (err) {
		Log.Red(err)
		console.log(err)
	}
}
