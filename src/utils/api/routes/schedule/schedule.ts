import Router from 'koa-router'
import _ from 'lodash'
import { Log } from '@lib/PlutoConfig.js'
import GameSchedule from '../../requests/matchups/GameSchedule.js'
import {
	IConfigRow,
	IMatchupAggregated,
	SportsServing,
} from '../../common/interfaces/kh-pluto/kh-pluto.interface.js'

/**
 * Responsible for incoming requests to post the daily schedule
 * @param {Object} aggregatedMatchups - Array of matches
 * @param {Array} dailyScheduleRows - Array of channel IDs to send the schedule to // `subscribers`
 */
const ScheduleRouter = new Router()
interface ScheduleRequestBody {
	aggregatedMatchups: IMatchupAggregated[]
	dailyScheduleRows: IConfigRow[]
}

ScheduleRouter.post('/schedule/daily/all', async (ctx) => {
	try {
		const requestBody: ScheduleRequestBody = ctx.request
			.body as ScheduleRequestBody
		const { aggregatedMatchups, dailyScheduleRows } =
			await validateAndParseSchedule(requestBody)
		const gameSchedule = new GameSchedule()

		for (const sport of Object.values(SportsServing)) {
			Log.Yellow(`Processing Daily Schedule for ${sport}`)
			const games = filterGames(aggregatedMatchups, sport)
			const rows = filterRows(dailyScheduleRows, sport)
			if (games === null || games.length === 0) {
				Log.Red(`No games found for ${sport}`)
				return
			}
			if (!rows) {
				Log.Red(`No channels found for ${sport}`)
				return
			}
			await gameSchedule.sendDailyGames(sport, games, rows)
			Log.Green(`Successfully sent daily schedule for ${sport}`)
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

function filterGames(
	games: IMatchupAggregated[],
	sport: any,
): IMatchupAggregated[] | null {
	// Check if the sport exists within the SportsServing object keys
	if (!Object.values(SportsServing).includes(sport)) {
		return null
	}
	return _.filter(games, (game) => game.sport_title === sport)
}

function filterRows(rows: IConfigRow[], sport: string) {
	return _.filter(rows, (row) => row.sport === sport)
}

async function validateAndParseSchedule(
	body: ScheduleRequestBody,
): Promise<ScheduleRequestBody> {
	const { aggregatedMatchups, dailyScheduleRows } = body
	console.log(
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
