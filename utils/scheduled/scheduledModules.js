import _ from 'lodash'
import cron from 'node-cron'
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
import IsoManager from '#iso'
import cronCompletedChecks from '../bot_res/cronCompletedChecks.js'

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
	cron.schedule(`${gameHeartbeat}`, async () => {
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
	await cron.schedule(`${scheduledGames}`, async () => {
		await cronScheduleGames()
	})
}

export async function genRanges() {
	// const matches = await MatchupManager.matchupsForDay()
	// if (_.isEmpty(matches)) {
	// 	return null
	// }
	// // # Remove everything except the `startTime` prop in the array of objects using Lodash
	// const startTimesArr = _.map(matches, 'startTime')
	// // ? Sort earliest to latest
	// startTimesArr.sort()
	const startTimesArr = [
		'2023-09-12T20:00:00.827Z',
		'2023-09-12T20:30:00.827Z',
		'2023-09-12T21:00:00.827Z',
		'2023-09-12T21:30:00.827Z',
		'2023-09-12T22:00:00.827Z',
		'2023-09-12T22:30:00.827Z',
		'2023-09-12T23:00:00.827Z',
	]
	const cronRanges = await cronCompletedChecks(
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
		text: `Init Matchup Handling`,
		color: `yellow`,
		status: `processing`,
	})

	await cron.schedule(`${getRanges}`, async () => {
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

async function checkForCompleted(cronTime) {
	logClr({
		text: `Cron Timer |> ${cronTime}`,
		color: `blue`,
		status: `processing`,
	})
	await cron.schedule(
		`${cronTime}`,
		async () => {
			try {
				logClr({
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
		{
			timezone: 'America/New_York',
			name: `checkCompleted`,
			scheduled: true,
		},
	)
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
	await cron.schedule(
		`${getOdds}`,
		async () => {
			try {
				const games = await Cache().get(`scheduled`)
				if (_.isEmpty(games)) {
					return
				}
				const dates = _.map(
					games,
					(game) => game?.date,
				)
				await gameHeartbeat(dates)
			} catch (err) {
				await PlutoLogger.log({
					id: 2,
					description: `An error occured when creating Game Heartbeat Cron Job\nError: \`${err.message}\``,
				})
			}
		},
		{
			timezone: 'America/New_York',
			name: `collectOdds`,
		},
	)
}
