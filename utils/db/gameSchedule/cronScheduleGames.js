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
import { LIVEMATCHUPS } from '#config'
import { getShortName } from '../../bot_res/getShortName.js'
import { scheduleChannels } from './scheduleChannels.js'
import IsoManager from '#iso'
import locateChannel from '../../bot_res/locateChan.js'
import Cache from '#rCache'
import logClr from '#colorConsole'
import PlutoLogger from '#PlutoLogger'
import parseScheduled from '../../bot_res/parseScheduled.js'

/**
 *
 *  @summary Generate Cron Jobs for Game Channel creation
 *  @description Captures games that are wtihin today to be scheduled
 * If there's games that are within the current day & have yet to have a game channel created, they will be created
 * Game channels are scheduled to be by default 1 hour ahead of the game.
 * If we are within 1 hour or already past (game started), this module will create the channels right now
 *
 * Overall, responsible for
 * - Scheduling the creation of game channels
 * - Sending notification to log channel what channels have been scheduled for the day
 */

export default async function cronScheduleGames() {
	const scheduledTally = []
	const scheduledIds = []
	const games = await db
		.manyOrNone(
			`SELECT * FROM "${LIVEMATCHUPS}" WHERE inprogress = false OR inprogress IS NULL`,
		)
		.catch((err) => {
			throw err
		})

	const filterGames = _.filter(games, async (game) => {
		// ? Filter via date
		let thisWeek
		const dateManager = new IsoManager(game.start)
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

		// ? Filter completed games
		let isCompleted
		if (
			game?.completed === true ||
			game?.status === 'completed'
		) {
			isCompleted = true
		}

		// ? Filter old games
		let isInPast
		if (dateManager.notInPast) {
			isInPast = true
		} else {
			isInPast = false
		}
		return thisWeek && !isCompleted && !isInPast
	})

	await Promise.map(
		filterGames,
		async (game) => {
			const isoManager = new IsoManager(game.start)
			let cronTime = null
			const parsedGameDate = parseISO(game.start)
			const now = new Date()
			const oneHourFromNow = addHours(now, 1)

			const homeTeam = await getShortName(
				game.teamone,
			)
			const awayTeam = await getShortName(
				game.teamtwo,
			)

			let matchupStr
			if (SPORT === 'nba') {
				matchupStr = `${awayTeam}-vs-${homeTeam}`
			} else {
				matchupStr = `${awayTeam}-at-${homeTeam}`
			}
			// Don't schedule channels that already exist
			const chanExist = await locateChannel(
				matchupStr,
			)
			if (chanExist) {
				return
			}

			/**
			 * Checks if the game with the given id is already scheduled.
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

			const hourOrLess = isWithinInterval(
				parsedGameDate,
				{
					start: now,
					end: oneHourFromNow,
				},
			)
			let queue1HEarly = false
			const past = isPast(parsedGameDate)
			if (hourOrLess || past) {
				// ? Game ISO time is within an hour
				// ? Create Cron set to exactly 1 minute from the current time
				cronTime = isoManager.cronRightNow
			} else {
				// ? Game ISO time is beyond 1 hour
				queue1HEarly = true
				cronTime = isoManager.cron
			}
			await scheduleChannels(
				game.teamone,
				game.teamtwo,
				{
					cronStartTime: cronTime,
					legible: isoManager.legible,
					gameid: game.id,
					queue1HEarly,
				},
			)
			await scheduledTally.push({
				home_team: game.teamone,
				away_team: game.teamtwo,
				start: isoManager.timeOnly,
				day: isoManager.dayName,
				date: game.start,
			})
			await scheduledIds.push(game.id)
		},
		{ concurrency: 1 },
	)
	if (!_.isEmpty(scheduledTally)) {
		await Cache().set(`scheduled`, scheduledTally)
		await Cache().set(`scheduledIds`, scheduledIds)
	}
	// ? Tally is at 0 if no new games were scheduled. This means the app likely still has games for the week scheduled.
	await logClr({
		text: `# of New Scheduled Games: ${scheduledTally.length}`,
		color: `green`,
		status: `done`,
	})
	const emb = await parseScheduled(scheduledTally, SPORT)
	await PlutoLogger.sendEmbed(emb)
	return true
}
