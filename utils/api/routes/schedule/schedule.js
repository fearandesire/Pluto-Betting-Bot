import Router from 'koa-router'
import _ from 'lodash'
import { Log } from '@pluto-core-config'
import GameSchedule from '../../requests/matchups/GameSchedule.js'

const ScheduleRouter = new Router()

ScheduleRouter.post('/schedule/daily/all', async (ctx) => {
	try {
		const { aggregatedMatchups, dailyScheduleRows } =
			await validateAndParseSchedule(ctx)

		const sports = ['NBA', 'NFL'] // Extendable to other sports
		const gameSchedule = new GameSchedule()

		for (const sport of sports) {
			await Log.Yellow(
				`Processing Daily Schedule for ${sport}`,
			)
			const games = filterGames(
				aggregatedMatchups,
				sport,
			)
			const rows = filterRows(
				dailyScheduleRows,
				sport,
			)

			if (!_.isEmpty(games)) {
				await gameSchedule.sendDailyGames(
					sport,
					games,
					rows,
				)
				await Log.Green(
					`Successfully sent daily schedule for ${sport}`,
				)
			}
		}

		ctx.body = {
			message: 'Daily schedule successfully sent!',
		}
		ctx.status = 200
	} catch (err) {
		console.error(err)
		ctx.status = err.status || 500
		ctx.body = { error: err.message }
	}
})

function filterGames(games, sport) {
	return _.filter(
		games,
		(game) => game.sport_title === sport,
	)
}

function filterRows(rows, sport) {
	return _.filter(rows, (row) => row.sport === sport)
}

async function validateAndParseSchedule(ctx) {
	const { aggregatedMatchups, dailyScheduleRows } =
		ctx.request.body || {}
	await console.log(
		`aggregatedMatchups`,
		aggregatedMatchups,
		`\n`,
		`dailyScheduleRows`,
		`\n`,
		dailyScheduleRows,
	)
	if (
		_.isEmpty(aggregatedMatchups) ||
		_.isEmpty(dailyScheduleRows)
	) {
		throw new Error('Invalid or missing schedule data')
	}

	return { aggregatedMatchups, dailyScheduleRows }
}

export default ScheduleRouter
