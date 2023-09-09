import { Cron } from 'croner'
import _ from 'lodash'
import { handleBetMatchups } from '#api/handleBetMatchups'
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
import Cache from '#rCache'
import { MatchupManager } from '#MatchupManager'
import cronRangeGenerator from '../api/cronRangeGenerator.js'

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

export async function genRanges() {
	const matches = await MatchupManager.matchupsForDay()
	if (_.isEmpty(matches)) {
		return
	}
	// # Remove everything except the `startTime` prop in the array of objects using Lodash
	const startTimesArr = _.map(matches, 'startTime')
	// Sort earliest to latest
	startTimesArr.sort()
	const cronRanges = await cronRangeGenerator(
		startTimesArr,
	)
	return cronRanges
}

/**
 * Init Cron Jobs for:
 * - Generating Cron Job Ranges (Ranges to check for compelted games, handle bets for said games)
 * - Checking for completed games to process bets
 */
export async function initMatchupHandling() {
	logClr({
		text: `Init Cron Job for Checking Completed Games`,
		color: `yellow`,
		status: `processing`,
	})
	// eslint-disable-next-line no-unused-vars
	const cron = new Cron(`${getRanges}`, async () => {
		try {
			const cronRanges = await genRanges()
			await Cache().set(`cronRanges`, cronRanges)
			await init_Cron_Completed(cronRanges)
		} catch (err) {
			await PlutoLogger.log({
				id: 4,
				description: `An error occured when creating generating Cron Ranges\nError: \`${err.message}\``,
			})
		}
	})
}

/**
 * Check for completed games to process bets.
 * Checks make API queries - so we will make the Cron run between two time ranges based on `cronRanges` value from Cache
 */

async function init_Cron_Completed(cachedRanges) {
	logClr({
		text: `Init Cron Job for Checking Completed Games`,
		color: `yellow`,
		status: `processing`,
	})
	await _.forEach(cachedRanges, async (range) => {
		// eslint-disable-next-line no-unused-vars
		const cron = new Cron(`${range}`, async () => {
			try {
				await handleBetMatchups()
			} catch (err) {
				await PlutoLogger.log({
					id: 4,
					description: `An error occured when checking & processing bets\nError: \`${err.message}\``,
				})
			}
		})
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
