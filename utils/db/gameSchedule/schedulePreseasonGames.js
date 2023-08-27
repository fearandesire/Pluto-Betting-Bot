/* eslint-disable camelcase */
import _ from 'lodash'
import {
	isToday,
	parseISO,
	isWithinInterval,
	addHours,
	isPast,
} from 'date-fns'
import Promise from 'bluebird'
import { db } from '#db'
// import { PRESZN_MATCHUPS_TABLE, spinner } from '#config'
import { getShortName } from '../../bot_res/getShortName.js'
import { scheduleChannels } from './scheduleChannels.js'
import IsoManager from '../../time/IsoManager.js'
import locateChannel from '../../bot_res/locateChan.js'
import Cache from '#rCache'
import logClr from '#colorConsole'
import { serverConf } from '../../serverConfig.js'

/**
 * @module schedulePreseasonGames
 * Generate Cron Jobs for Game Channel creation for Preseason Games
 * Captures games that are wtihin today to be scheduled
 * If there's games that are within the current day & have yet to have a game channel created, they will be created
 * Game channels are scheduled to be by default 1 hour ahead of the game. If we are within 1 hour or already past (game started):
 * This module will create the channels right now
 *
 */
export default async function schedulePreseasonGames() {
	const scheduledTally = []
	const games = await db.manyOrNone(
		`SELECT * FROM "${serverConf.preseason_matchups_tbl}"`,
	)
	const filterGames = _.filter(games, (game) => {
		const gameDate = parseISO(game.date)
		return isToday(gameDate) && !game.completed
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
				await scheduleChannels(
					game.home_team,
					game.away_team,
					{
						cronStartTime: cronTime,
						legible: isoManager.legible,
					},
				)
				await scheduledTally.push({
					home_team: game.home_team,
					away_team: game.away_team,
					start: isoManager.legible,
				})
			} else {
				// Game is scheduled in the future beyond 1 hour
				cronTime = isoManager.cron
				await scheduleChannels(
					game.home_team,
					game.away_team,
					{
						cronStartTime: cronTime,
						legible: isoManager.legible,
						notSubtracted: true,
					},
				)
				await scheduledTally.push({
					home_team: game.home_team,
					away_team: game.away_team,
					start: isoManager.legible,
				})
			}
		},
		{ concurrency: 1 },
	)
	await Cache().set(`scheduled`, scheduledTally)
	await logClr({
		text: `# of Scheduled Games: ${scheduledTally.length}`,
		color: `green`,
		status: `done`,
	})
	return true
}
