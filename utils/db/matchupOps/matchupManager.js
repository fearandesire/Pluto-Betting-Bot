import cron from 'node-cron'
import { format } from 'date-fns'
import { db } from '#db'
import { LIVEMATCHUPS, RANGES } from '#env'
import { logCron } from '#apiUtils'
import { checkCompleted } from '../../api/checkCompleted.js'
import { Log, _ } from '#config'

export function todaysDayNum() {
	const d = new Date()
	const dayNum = d.getDate()
	return dayNum
}

/**
 * @module fetchTodaysMatches
 * Fetches all the matches scheduled for today from the database
 * @returns {array} - An array of objects containing the matchups for today
 */
export async function fetchTodaysMatches() {
	const gamesOrdered = await db.manyOrNone(
		`SELECT * from "${LIVEMATCHUPS}" ORDER BY "startTime" ASC`,
	)
	const td = new Date()
	const today = format(td, 'MM/dd/yyyy')

	const todaysMatches = _.filter(gamesOrdered, async (match) => {
		const matchDate = match.dateofmatchup.toString()
		if (matchDate === today) {
			return true
		}
	})
	return todaysMatches
}

/**
 * To be used on a restart of the application to keep persistence of completed check API calls via Cron Jobs.
 * Query DB for the ranges. If there is data, init cron jobs for the ranges. Otherwise, log there was no ranges set.
 * Table 'RANGES
 * @function rangeRefresh
 */
export async function rangeRefresh() {
	const ranges = await db.manyOrNone(`SELECT * FROM "${RANGES}"`)
	if (!_.isEmpty(ranges)) {
		const { range1, range2 } = ranges[0]

		if (range1 === null) {
			Log.Red(`No ranges were found in the database.`)
			return false
		}
		await console.log(`Ranges: ${range1} ${range2}`)
		if (range1 !== undefined) {
			const splitrange1 = range1.split(' ')
			const day = splitrange1[2]
			if (Number(todaysDayNum()) !== Number(day)) {
				Log.Red(
					`Older range found in DB. Clearing table\nToday: ${todaysDayNum()}\nRange: ${day}`,
				)
				await db.none(`DELETE FROM "${RANGES}"`)
				return false
			}
			cron.schedule(
				`${range1}`,
				async () => {
					await checkCompleted()
				},
				{
					scheduled: true,
					timezone: 'America/New_York',
				},
			)
			logCron({
				title: `Range Refresh`,
				msg: `Init Cron Job Series for completed games.\nRange: ${range1}`,
			})
		}
		if (range2 !== undefined && range1 !== undefined) {
			cron.schedule(
				`${range2}`,
				async () => {
					await checkCompleted()
				},
				{
					scheduled: true,
					timezone: 'America/New_York',
				},
			)
			logCron({
				title: `Range Refresh`,
				msg: `Init Cron Job Series for completed games.\nRange: ${range2}`,
			})
		}
		return true
	}
	Log.Red(`No ranges were found in the database.`)
	return false
}

/**
 * Query DB and retrieve, or store the cron job time ranges to use for game score API calls.
 */
export async function rangeManager(options) {
	let res
	const { fetch, post, r1, r2 } = options
	// # Query `RANGES` tables for the cron job ranges
	const cronRanges = await db.oneOrNone(`SELECT * FROM "${RANGES}"`)
	if (fetch) {
		// # select `range1` and `range2` from the query
		const { range1, range2 } = cronRanges[0]
		res = { range1, range2 }
	}
	if (post) {
		// # Erase current data in the table, then post
		await db.none(`DELETE FROM "${RANGES}"`)
		await db.none(`INSERT INTO "${RANGES}" (range1, range2) VALUES ($1, $2)`, [
			r1,
			r2,
		])
		console.log(`[rangeManager] Stored Cron Ranges.`)
		res = true
	}
	return res
}
