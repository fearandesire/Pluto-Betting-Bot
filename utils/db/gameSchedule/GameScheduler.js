/* eslint-disable camelcase */
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import logClr from '@pluto-internal-color-logger'
import PlutoLogger from '@pluto-logger'
import IsoManager from '@pluto-iso-manager'
import { SPORT } from '@pluto-server-config'
import { getShortName } from '../../bot_res/getShortName.js'
import { scheduleChannels } from './scheduleChannels.js'
import locateChannel from '../../bot_res/locateChan.js'
import parseScheduled from '../../bot_res/parseScheduled.js'
import ScheduledChannelsManager from '../../bot_res/classes/ScheduledChannelsManager.js'
import {
	isDateTodayAndPast,
	isWithinOneHour,
} from '../../bot_res/dateUtils.js'

export default class GameScheduler {
	constructor() {
		this.newScheduledData = []
	}

	async init(args) {
		const { forceSchedule } = args || false
		try {
			const newScheduledGames =
				await this.getScheduledGames(forceSchedule)

			await this.processScheduledGames(
				newScheduledGames,
			)
		} catch (error) {
			console.error('Error scheduling games: ', error)
			// Additional error handling as needed
		}
	}

	async saveScheduledGames(gamesArr) {
		await ScheduledChannelsManager.setScheduled(
			gamesArr,
		)
	}

	async parseMatchTitle(ateam, hteam, sport) {
		const aTeamShort = getShortName(ateam)
		const hTeamShort = getShortName(hteam)
		if (sport === 'nfl') {
			return {
				aTeamShort,
				hTeamShort,
				title: `${aTeamShort}-at-${hTeamShort}`,
			}
		}
		if (sport === 'nba') {
			return {
				aTeamShort,
				hTeamShort,
				title: `${hTeamShort}-vs-${aTeamShort}`,
			}
		}
	}

	async getScheduledGames(forceSchedule) {
		const gamesArr =
			await MatchupManager.getAllMatchups()
		const newScheduledGames = []

		for (const game of gamesArr) {
			const shouldSchedule =
				await this.shouldScheduleGame(
					game,
					forceSchedule,
				)
			if (shouldSchedule) {
				const scheduledGame =
					await this.prepareScheduledGame(game)
				newScheduledGames.push(scheduledGame)
			}
		}
		return newScheduledGames
	}

	async shouldScheduleGame(game, forceSchedule) {
		const { title } = await this.parseMatchTitle(
			game.teamone,
			game.teamtwo,
			SPORT,
		)
		const isScheduled = game.scheduled || false
		const chanExist = await locateChannel(title)
		const todaysPriorGame = isDateTodayAndPast(
			game.cronstart,
		)
		const isFutureGame =
			new Date() < new Date(game.start)

		return (
			(todaysPriorGame || isFutureGame) &&
			!isScheduled &&
			!chanExist &&
			forceSchedule === false
		)
	}

	async prepareScheduledGame(game) {
		const { aTeamShort, hTeamShort, title } =
			await this.parseMatchTitle(
				game.teamone,
				game.teamtwo,
				SPORT,
			)
		let scheduledCreationTime = null
		let createNow = false
		// Log details
		const { cronstart: cronStart } = game
		const gameIsWithinOneHour = await isWithinOneHour(
			cronStart,
		)
		if (
			gameIsWithinOneHour ||
			isDateTodayAndPast(cronStart)
		) {
			scheduledCreationTime = await new IsoManager(
				game.start,
			).cronRightNow
			createNow = true
		} else {
			scheduledCreationTime = cronStart
		}

		const scheduledGame = {
			teamtwo: aTeamShort,
			teamone: hTeamShort,
			chanName: title.toLowerCase(),
			cronStart,
			start: game.legiblestart,
			dateofmatchup: game.dateofmatchup,
			legible: game.legiblestart,
			id: game.id,
			scheduledCreationTime,
			createNow,
		}

		await this.newScheduledData.push({
			id: game.id,
			scheduled_cron: scheduledCreationTime,
		})

		return scheduledGame
	}

	async processScheduledGames(newScheduledGames) {
		await this.saveScheduledGames(this.newScheduledData)
		for (const match of newScheduledGames) {
			await console.log(
				`Scheduling: ${match.chanName}`,
			)
			await scheduleChannels(
				match.teamtwo,
				match.teamone,
				{
					scheduledCreationTime:
						match.scheduledCreationTime,
					chanName: match.chanName,
					createNow: match.createNow,
				},
			)
		}

		// ? Post Schedule
		const matchups =
			await MatchupManager.getAllMatchups()
		const emb = await parseScheduled(matchups)
		await PlutoLogger.sendEmbed(emb)

		await logClr({
			text: `# of Currently Scheduled Games: ${
				newScheduledGames
					? newScheduledGames.length
					: 0
			}`,
			color: 'green',
			status: 'done',
		})
	}
}
