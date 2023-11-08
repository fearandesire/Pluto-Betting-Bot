import _ from 'lodash'
import { Cron } from 'croner'
import { subDays } from 'date-fns'
import logClr from '#colorConsole'
import cronScheduleGames from '../db/gameSchedule/cronScheduleGames.js'
import PlutoLogger from '#PlutoLogger'
import {
	getRanges,
	gameHeartbeat,
	scheduledGames,
	getOdds,
} from '#serverConf'
import { MatchupManager } from '#MatchupManager'
import cronCompletedChecks from '../bot_res/cronCompletedChecks.js'
import { getHeartbeat } from '../bot_res/betOps/gameHeartbeat.js'
import { handleBetMatchups } from '../bot_res/betOps/handleBetMatchups.js'
import collectOdds from '../bot_res/betOps/collectOdds.js'
import { TodaysDate } from '../date/TodaysDate.js'

export async function queueMidnightCheck() {
	await PlutoLogger.log({
		id: 0,
		description: `Queueing midnight check for completed games`,
	})
	await Cron(
		`00 00 * * *`,
		{
			timezone: 'America/New_York',
		},
		async () => {
			await midnightCheckCompleted()
		},
	)
}

/**
 * West Coast games start late and tend to end after midnight
 * This function is a solution to the `checkCompleted` Cron strings we generate
 */
export async function midnightCheckCompleted() {
	const wasGameDay = await priorGameDay()
	if (wasGameDay) {
		await Cron(
			`*/5 00-02 * * *`,
			{
				timezone: 'America/New_York',
			},
			async () => {
				await PlutoLogger.log({
					description: `Executing completed game checks\nMidnight - 2 AM`,
					id: 2,
				})
				await handleBetMatchups()
			},
		)
	}
}

/**
 * Checks if there are games that were scheduled for the prior day
 * Call matchups table in DB and verify against `dateofmatchup` (MM/DD/YYYY) against today
 *
 */

export async function priorGameDay() {
	const matches = await MatchupManager.getAllMatchups()
	if (_.isEmpty(matches)) {
		return false
	}
	const dates = _.map(matches, 'dateofmatchup')
	// Get todays date in MM/DD/YYYY
	const todaysDate = TodaysDate()
	// Minus 1 day from the date
	const priorDate = subtractOneDay(todaysDate)
	if (dates.includes(priorDate)) {
		return true
	}
	return false
}

function subtractOneDay(dateString) {
	const date = new Date(dateString)
	const previousDay = subDays(date, 1)
	const formattedDate =
		previousDay.toLocaleDateString('en-GB')
	return formattedDate
}

/**
 * @instant
 * Generate Cron Range to check for completed games starting from the earliest game of the day
 * @returns {string | null} - Cron Range or null if there are no games for the day
 */

export async function genRanges() {
	const matches = await MatchupManager.matchupsForDay() // Locate matches dated for the current day
	if (_.isEmpty(matches)) {
		return null
	}
	// # Remove everything except the `start` prop in the array of objects using Lodash
	const startTimesArr = _.map(matches, 'start')
	// ? Sort earliest to latest
	startTimesArr.sort()
	const cronRange = await cronCompletedChecks(
		startTimesArr,
	)
	return cronRange
}

/**
 * @instant
 * Check for completed games to process bets for
 */

async function checkForCompleted(cronTime) {
	await logClr({
		text: `Cron Timer |> ${cronTime}`,
		color: `blue`,
		status: `processing`,
	})
	// Set 1: Based on time of games collected
	await Cron(
		`${cronTime}`,
		{
			timezone: 'America/New_York',
		},
		async () => {
			try {
				await logClr({
					text: `Checking for completed games`,
					color: `blue`,
					status: `processing`,
				})
				await handleBetMatchups()
			} catch (err) {
				await PlutoLogger.log({
					id: 4,
					description: `An error occured when checking & processing bets\nError: \`${err.message}\``,
				})
			}
		},
	)
}

/**
 * @daily
 * Collect Odds based on Cron Timer
 */

export async function init_Cron_Odds() {
	logClr({
		text: `Init Cron Job for Collecting Odds`,
		color: `yellow`,
		status: `processing`,
	})
	await Cron(
		`${getOdds}`,
		{
			timezone: 'America/New_York',
		},
		async () => {
			try {
				await collectOdds()
			} catch (err) {
				await PlutoLogger.log({
					id: 2,
					description: `An error occured when creating Game Heartbeat Cron Job\nError: \`${err.message}\``,
				})
			}
		},
	)
}

/**
 * @daily
 * Initialize Cron Job for Scheduling Game Channels
 */
export async function init_Cron_Chan_Scheduler() {
	logClr({
		text: `Init Cron Job for Scheduling Game Channels`,
		color: `yellow`,
		status: `processing`,
	})
	// # Run Cron
	await Cron(`${scheduledGames}`, async () => {
		await cronScheduleGames()
	})
}

/**
 * @daily
 * Init Cron Jobs for:
 * - Generating Cron Job Ranges (Ranges to check for compelted games, handle bets for said games)
 * - Checking for completed games to process bets
 */
export async function initMatchupHandling() {
	logClr({
		text: `Init Matchup Handling`,
		color: `yellow`,
		status: `processing`,
	})

	await Cron(`${getRanges}`, async () => {
		try {
			const cronRanges = await genRanges()
			if (cronRanges !== null) {
				await checkForCompleted(cronRanges)
			}
		} catch (err) {
			await PlutoLogger.log({
				id: 4,
				description: `An error occured when creating generating Cron Ranges\nError: \`${err.message}\``,
			})
		}
	})
}

/**
 * @daily
 * Init Cron Job to check for completed games
 */

export async function init_Cron_Completed() {
	logClr({
		text: `Init Cron Completed`,
		color: `yellow`,
		status: `processing`,
	})

	// Fetch Cron Range String
	const cRangeStr = await genRanges()
	if (!cRangeStr) {
		logClr({
			text: `No Cron Ranges to process |> No games scheduled today.`,
			color: `red`,
			status: `done`,
		})
		return
	}

	await checkForCompleted(cRangeStr)
}

/**
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
	Cron(`${gameHeartbeat}`, async () => {
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
