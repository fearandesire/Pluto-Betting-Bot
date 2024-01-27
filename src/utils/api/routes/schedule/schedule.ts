import Router from 'koa-router'
import _ from 'lodash'
import { Log } from '@pluto-core-config'
import GameSchedule from '../../requests/matchups/GameSchedule.js'
import {
	IConfigRow,
	IMatchupAggregated,
	SportsServing,
} from '../../../../lib/interfaces/api/ApiInterfaces.js'

const ScheduleRouter = new Router()
interface ScheduleRequestBody {
	aggregatedMatchups: IMatchupAggregated[]
	dailyScheduleRows: IConfigRow[]
}
ScheduleRouter.post('/schedule/daily/all', async (ctx) => {
	try {
		const requestBody: ScheduleRequestBody = ctx.request.body as
			| ScheduleRequestBody
			| any
		const { aggregatedMatchups, dailyScheduleRows } =
			await validateAndParseSchedule(requestBody)
		const gameSchedule = new GameSchedule()

		for (const sport of Object.values(SportsServing)) {
			await Log.Yellow(`Processing Daily Schedule for ${sport}`)
			const games = filterGames(aggregatedMatchups, sport)
			const rows = filterRows(dailyScheduleRows, sport)

			if (!_.isEmpty(games)) {
				await gameSchedule.sendDailyGames(sport, games, rows)
				await Log.Green(`Successfully sent daily schedule for ${sport}`)
			}
		}

		ctx.body = {
			message: 'Daily schedule successfully sent!',
		}
		ctx.status = 200
	} catch (err) {
		console.error(err)
		ctx.body = err
	}
})

function filterGames(games: IMatchupAggregated[], sport: SportsServing) {
	return _.filter(games, (game) => game.sport_title === sport)
}

function filterRows(rows: IConfigRow[], sport: SportsServing) {
	return _.filter(
		rows,
		(row) => typeof row.sport === 'string' && row.sport === sport,
	)
}

async function validateAndParseSchedule(
	body: ScheduleRequestBody,
): Promise<ScheduleRequestBody> {
	const { aggregatedMatchups, dailyScheduleRows } = body
	await console.log(
		`aggregatedMatchups`,
		aggregatedMatchups,
		`\n`,
		`dailyScheduleRows`,
		`\n`,
		dailyScheduleRows,
	)
	if (_.isEmpty(aggregatedMatchups) || _.isEmpty(dailyScheduleRows)) {
		throw new Error('Invalid or missing schedule data')
	}

	return { aggregatedMatchups, dailyScheduleRows }
}

export default ScheduleRouter
