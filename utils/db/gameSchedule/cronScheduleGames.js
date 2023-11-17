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
 * @summary Generate Cron Jobs for Game Channel creation
 * @description Uses `cronstart` for scheduling game channels.
 * Ensures that channels for today's games are created.
 */
export default async function cronScheduleGames() {
	const scheduledIds = []
	const scheduledContainer = []
	const gamesArr = await MatchupManager.getAllMatchups()

	for await (const game of gamesArr) {
		const hTeamShortName = await getShortName(
			game.teamone,
		)
		const aTeamShortName = await getShortName(
			game.teamtwo,
		)
		const matchupStr = `${hTeamShortName}-vs-${aTeamShortName}`

		const isCompleted = game.complete || false
		const scheduledCache =
			(await Cache().get(`scheduled_games`)) || []
		let isScheduled
		if (!_.isEmpty(scheduledCache)) {
			isScheduled = _.find(scheduledCache, {
				gameid: game.id,
			})
		} else {
			isScheduled = false
		}
		const chanExist = await locateChannel(matchupStr)
		const resolveChanExist = await Promise.resolve(
			chanExist,
		)

		const todaysPriorGame = isDateTodayAndPast(
			game.cronstart,
		)
		const isFutureGame =
			new Date() < new Date(game.start)

		const createNow = await isWithinOneHour(
			game.cronstart,
		)
		if (
			(!isCompleted &&
				!isScheduled &&
				!resolveChanExist &&
				todaysPriorGame) ||
			isFutureGame
		) {
			let cronTime = game.cronstart
			let queueEarly = true
			if (createNow) {
				cronTime = new IsoManager(game.start)
					.cronRightNow
				queueEarly = false
			}
			await scheduledContainer.push({
				home_team: game.teamone,
				away_team: game.teamtwo,
				cronStartTime: cronTime,
				legible: game.legiblestart,
				gameid: game.id,
				queue1HEarly: queueEarly,
			})
			await scheduledCache.push({
				home_team: game.teamone,
				away_team: game.teamtwo,
				cronstart: cronTime,
				start: game.legiblestart,
				date: game.dateofmatchup,
				gameid: game.id,
			})
			await scheduledIds.push(game.id)
			await Cache().set(
				`scheduled_games`,
				scheduledCache,
			)
		}
	}

	for await (const match of scheduledContainer) {
		await scheduleChannels(
			match.home_team,
			match.away_team,
			{
				cronStartTime: match.cronStartTime,
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
