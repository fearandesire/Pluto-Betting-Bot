/* eslint-disable camelcase */
import _ from 'lodash'
import Promise from 'bluebird'
import { SPORT } from '#env'
import { getShortName } from '../../bot_res/getShortName.js'
import { scheduleChannels } from './scheduleChannels.js'
import locateChannel from '../../bot_res/locateChan.js'
import Cache from '#rCache'
import logClr from '#colorConsole'
import PlutoLogger from '#PlutoLogger'
import parseScheduled from '../../bot_res/parseScheduled.js'
import { MatchupManager } from '#MatchupManager'
import {
	isDateTodayAndPast,
	isWithinOneHour,
} from '../../bot_res/dateUtils.js'
import IsoManager from '#iso'

/**
 * Generate Cron Jobs for Game Channel creation
 * Uses game Cron Time (prop `cronstart`) for scheduling game channels.
 * @param {boolean} createPrior - Flag to indicate that games within the current day should be created, specifically for games that are already active.
 * This is necessary in the event of an app restart / service issues and game channels need to be created
 */
export default async function cronScheduleGames(
	createPrior,
) {
	const scheduledIds = []
	const matchupsContainer = []
	const gamesArr = await MatchupManager.getAllMatchups()
	const scheduledCache =
		(await Cache().get(`scheduled_games`)) || []
	for await (const game of gamesArr) {
		const hTeamShortName = await getShortName(
			game.teamone,
		)
		const aTeamShortName = await getShortName(
			game.teamtwo,
		)
		let scheduledCreationTime = null
		const cronTime = game.cronstart
		const matchupStr = `${aTeamShortName}-at-${hTeamShortName}`

		const isCompleted = game.complete || false
		let isScheduled = false
		if (
			!_.isEmpty(scheduledCache) ||
			!_.isUndefined(scheduledCache) ||
			scheduledCache
		) {
			// Search for matching game.id
			const locateInCache =
				(await scheduledCache.find(
					(g) => g.id === game.id,
				)) || false
			if (locateInCache) {
				isScheduled = true
			}
		} else {
			isScheduled = false
		}
		const chanExist = await locateChannel(matchupStr)
		const resolveChanExist = await Promise.resolve(
			chanExist,
		)
		const todaysPriorGame = isDateTodayAndPast(cronTime)
		const isFutureGame =
			new Date() < new Date(game.start)

		const gameIsWithinOneHour = await isWithinOneHour(
			cronTime,
		)
		if (
			(todaysPriorGame || isFutureGame) &&
			!isCompleted &&
			!isScheduled &&
			!resolveChanExist
		) {
			let queueEarly = true
			if (
				(gameIsWithinOneHour || todaysPriorGame) &&
				createPrior
			) {
				scheduledCreationTime =
					await new IsoManager(game.start)
						.cronRightNow
				queueEarly = false
			} else {
				scheduledCreationTime = cronTime
			}
			// Used to schedule the game based on the input information
			await matchupsContainer.push({
				home_team: game.teamone,
				away_team: game.teamtwo,
				cronStart: cronTime,
				legible: game.legiblestart,
				gameid: game.id,
				queue1HEarly: queueEarly,
				scheduledCreationTime,
			})
			// Used to keep track of what we have successfully scheduled
			await scheduledCache.push({
				home_team: game.teamone,
				away_team: game.teamtwo,
				chanName: matchupStr.toLowerCase(),
				cronStart: cronTime,
				start: game.legiblestart,
				date: game.dateofmatchup,
				gameid: game.id,
				scheduledCreationTime,
			})
			await scheduledIds.push(game.id)
			await Cache().set(
				`scheduled_games`,
				scheduledCache,
			)
		}
	}

	for await (const match of matchupsContainer) {
		await scheduleChannels(
			match.home_team,
			match.away_team,
			{
				scheduledCreationTime:
					match.scheduledCreationTime,
				queue1HEarly: match.queue1HEarly,
				gameId: match.gameid,
			},
		)
	}

	const schCache = await Cache().get(`scheduled_games`)
	if (schCache.length > 0) {
		const emb = await parseScheduled(schCache, SPORT)
		await PlutoLogger.sendEmbed(emb)
	}

	await logClr({
		text: `# of New Scheduled Games: ${schCache.length}`,
		color: 'green',
		status: 'done',
	})

	return true
}
