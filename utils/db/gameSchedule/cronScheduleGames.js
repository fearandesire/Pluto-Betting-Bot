/* eslint-disable camelcase */
import _ from 'lodash'
import {
	parseISO,
	isWithinInterval,
	addHours,
	isPast,
} from 'date-fns'
import Promise from 'bluebird'
import { db } from '#db'
// import { PRESZN_MATCHUPS_TABLE, spinner } from '#config'
import { SPORT } from '#env'
import { getShortName } from '../../bot_res/getShortName.js'
import { scheduleChannels } from './scheduleChannels.js'
import IsoManager from '#iso'
import locateChannel from '../../bot_res/locateChan.js'
import Cache from '#rCache'
import logClr from '#colorConsole'
import { SCORETABLE } from '#serverConf'
import PlutoLogger from '#PlutoLogger'
import parseScheduled from '../../bot_res/parseScheduled.js'

/**
 * @module cronScheduleGames
 * Generate Cron Jobs for Game Channel creation
 * Captures games that are wtihin today to be scheduled
 * If there's games that are within the current day & have yet to have a game channel created, they will be created
 * Game channels are scheduled to be by default 1 hour ahead of the game. If we are within 1 hour or already past (game started):
 * This module will create the channels right now
 */

export default async function cronScheduleGames() {
	const scheduledTally = []
	const scheduledIds = []
	const games = await db.manyOrNone(
		`SELECT * FROM "${SCORETABLE}" WHERE completed = false`,
	)

	const filterGames = _.filter(games, async (game) => {
		let thisWeek
		const dateManager = new IsoManager(game.date)
		if (SPORT === 'nba') {
			thisWeek = dateManager.sevenDayWeek
		} else if (SPORT === 'nfl') {
			thisWeek = await dateManager.nflWeek
		} else {
			await PlutoLogger.log({
				title: `Game Scheduling Logs`,
				description: `Error: ${SPORT} is not supported.\nCheck app configuration`,
			})
		}
		return thisWeek
	})

	await Promise.map(
		filterGames,
		async (game) => {
			const isoManager = new IsoManager(game.date)
			let cronTime = null
			const parsedGameDate = parseISO(game.date)
			const now = new Date()
			const oneHourFromNow = addHours(now, 1)

			const homeTeam = await getShortName(
				game.home_team,
			)
			const awayTeam = await getShortName(
				game.away_team,
			)
			const chanTitle = `${awayTeam}-vs-${homeTeam}`
			// Don't schedule channels already open
			const chanExist = await locateChannel(chanTitle)
			if (chanExist) {
				return
			}

			/**
			 * Checks if the game with the given id is already scheduled.
			 *
			 * @return {boolean} True if the game is already scheduled, false otherwise.
			 */
			const checkIfScheduled = async () => {
				const scheduled_gameIds = await Cache().get(
					`scheduledIds`,
				)
				if (
					!scheduled_gameIds ||
					_.isEmpty(scheduled_gameIds)
				) {
					return false
				}
				return _.includes(
					scheduled_gameIds,
					game.id,
				)
			}

			const isScheduled = await checkIfScheduled()

			if (isScheduled) {
				await logClr({
					text: `Skipped game as it was already scheduled. => ${game.id}`,
					color: `green`,
					status: `done`,
				})
				return
			}

			let queueEarly = false
			if (
				isWithinInterval(parsedGameDate, {
					start: now,
					end: oneHourFromNow,
				}) ||
				isPast(parsedGameDate)
			) {
				// Game is scheduled within 1 hour
				// Create Cron set to exactly 1 minute from the current time
				cronTime = isoManager.cronRightNow
				queueEarly = true
			} else {
				// Game is scheduled in the future beyond 1 hour
				cronTime = isoManager.cron
			}
			await scheduleChannels(
				game.home_team,
				game.away_team,
				{
					cronStartTime: cronTime,
					legible: isoManager.legible,
					queueEarly,
					gameid: game.id,
				},
			)
			await scheduledTally.push({
				home_team: game.home_team,
				away_team: game.away_team,
				start: isoManager.timeOnly,
				day: isoManager.dayName,
				date: game.date,
			})
			await scheduledIds.push(game.id)
		},
		{ concurrency: 1 },
	)
	await Cache().set(`scheduled`, scheduledTally)
	await Cache().set(`scheduledIds`, scheduledIds)
	await logClr({
		text: `# of Scheduled Games: ${scheduledTally.length}`,
		color: `green`,
		status: `done`,
	})
	const emb = await parseScheduled(scheduledTally, SPORT)
	await PlutoLogger.sendEmbed(emb)
	return true
}
