import { Cron } from 'croner'
import _ from 'lodash'
import { getHeartbeat } from '../api/gameHeartbeat.js'
import logClr from '#colorConsole'
import cronScheduleGames from '../db/gameSchedule/cronScheduleGames.js'
import PlutoLogger from '#PlutoLogger'
import {
	getRanges,
	gameHeartbeat,
	scheduledGames,
	getOdds,
} from '#serverConf'
import completedChecks from '../bot_res/cronCompletedChecks.js'
import Cache from '#rCache'

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
	const cron = new Cron(`${gameHeartbeat}`, async () => {
		try {
			await getHeartbeat()
		} catch (err) {
			await PlutoLogger.log({
				id: 2,
				description: `An error occured when checking the heartbeat of games\nError: \`${err.message}\``,
			})
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

/**
 * @function init_Cron_Ranges
 * Initialize Cron Job for checking completed games to handle bets & closing game channels
 */

export async function init_Cron_Ranges() {
	logClr({
		text: `Init Cron Job for Checking Completed Games`,
		color: `yellow`,
		status: `processing`,
	})
	// eslint-disable-next-line no-unused-vars
	const cron = new Cron(`${getRanges}`, async () => {
		try {
			const games = await Cache().get(`scheduled`)
			if (_.isEmpty(games)) {
				return
			}
			const dates = _.map(games, (game) => game?.date)
			await completedChecks(dates)
		} catch (err) {
			await PlutoLogger.log({
				id: 2,
				description: `An error occured when creating Completed Check Cron Ranges\nError: \`${err.message}\``,
			})
		}
	})
}

/**
 * Collect Odds based on Cron Timer
 */

export async function init_Cron_Odds() {
	logClr({
		text: `Init Cron Job for Collecting Odds`,
		color: `yellow`,
		status: `processing`,
	})
	// eslint-disable-next-line no-unused-vars
	const cron = new Cron(`${getOdds}`, async () => {
		try {
			const games = await Cache().get(`scheduled`)
			if (_.isEmpty(games)) {
				return
			}
			const dates = _.map(games, (game) => game?.date)
			await gameHeartbeat(dates)
		} catch (err) {
			await PlutoLogger.log({
				id: 2,
				description: `An error occured when creating Game Heartbeat Cron Job\nError: \`${err.message}\``,
			})
		}
	})
}
