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
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
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
 *
 *  @summary Generate Cron Jobs for Game Channel creation
 *  @description Captures games that are wtihin today to be scheduled
 * If there's games that are within the current day & have yet to have a game channel created, they will be created
 * Game channels are scheduled to be by default 1 hour ahead of the game.
 * If we are within 1 hour or already past (game started), this module will create the channels right now
 *
 * Overall, responsible for
 * - Scheduling the creation of game channels
 * - Sending notification to log channel what channels have been scheduled
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

			// Ensure matchup is still active
			const isMatchupActive = await resolveMatchup(
				homeTeam,
			)

			if (!isMatchupActive) {
				console.log(
					`Matchup ${matchupStr} is no longer active.`,
				)
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
			const past = isPast(parsedGameDate)
			if (hourOrLess || past) {
				// Game is scheduled within 1 hour
				// Create Cron set to exactly 1 minute from the current time
				cronTime = isoManager.cronRightNow
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
