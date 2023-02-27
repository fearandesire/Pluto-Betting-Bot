import cronstrue from 'cronstrue'
import cronParser from 'cron-parser'
import stringifyObject from 'stringify-object'
import { format } from 'date-fns'
import { Log, LIVEMATCHUPS } from '#config'
import { db } from '#db'
import dmMe from '../../bot_res/dmMe.js'
import { resolveToday } from '#dateUtil/resolveToday'

/**
 * @module resolveCompCron
 *
 * @summary Generates the Cron Jobs to center our API calls for completed games ({@link checkCompleted}) around them. [resolveCompCron > resolve Completed Check Cron].
 *
 * @description  This function will check the Cron strings for potential cases of cron related errors from invalid time strings.
 * The necessity of this function is to create blocks of time where API requests are made.
 * Confining API calls in a range will limit the use of it, creating a more efficient use of the API, and most importantly, maintain the costs.
 *
 * @returns {Object} - Object containing the ranges of the Cron Jobs that will be used in {@link completedReq}
 */

/**
 * @module resolveCompCron
 *
 * @summary Generates the Cron Jobs to center our API calls for completed games ({@link checkCompleted}) around them. [resolveCompCron > resolve Completed Check Cron].
 *
 * @description  This function will check the Cron strings for potential cases of cron related errors from invalid time strings.
 * The necessity of this function is to create blocks of time where API requests are made.
 * Confining API calls in a range will limit the use of it, creating a more efficient use of the API, and most importantly, maintain the costs.
 *
 * @returns {Object} - Object containing the ranges of the Cron Jobs that will be used in {@link completedReq}
 */

export async function resolveCompCron() {
	await Log.Yellow(
		`[resolveCompCron.js] Resolving Cron Jobs for completed games..`,
	)

	const todaySlash = (await new resolveToday().todayFullSlashes).toString()

	const data = await fetchMatchupsForDay(todaySlash)

	if (!data || data.length === 0) {
		await Log.Red(`[resolveCompCron.js] No games scheduled today`)
		return false
	}

	const { earliestTime, latestTime } = getEarliestAndLatestTimes(data)

	const { earliestRange, latestRange } = calculateCronRanges(
		earliestTime,
		latestTime,
	)

	const cronJobs = {
		range1: `*/5 ${earliestRange.cronHour} ${earliestRange.dayOfMonth} ${earliestRange.month} ${earliestRange.dayOfWeek}`,
	}

	if (!latestRange.oneGame) {
		cronJobs.range2 = `*/5 ${latestRange.cronHour} ${latestRange.dayOfMonth} ${latestRange.month} ${latestRange.dayOfWeek}`
	}

	const rangesEnglish = `[resolveCompCron.js] Earliest Game Time Today: ${cronstrue.toString(
		earliestTime.cronstart,
	)} || Latest Game Time Today: ${cronstrue.toString(latestTime.cronstart)}`

	console.log(rangesEnglish)

	await dmMe(
		`Today's Cron Ranges:\n\`\`\`js\n${stringifyObject(cronJobs)}\`\`\``,
	)

	return cronJobs
}

/**
 * Fetches Matchups for the day.
 * @async
 * @function fetchMatchupsForDay
 * @param {string} todaySlash - The date to fetch the matchups for in the format "YYYY/MM/DD".
 * @returns {Array} - An array of matchups for the day.
 */
async function fetchMatchupsForDay(todaySlash) {
	return await db.manyOrNone(
		`SELECT * FROM "${LIVEMATCHUPS}" WHERE dateofmatchup = $1 ORDER BY "startTime" ASC`,
		[todaySlash],
	)
}

/**
 * Gets the earliest and latest times from the matchups data.
 * @function getEarliestAndLatestTimes
 * @param {Array} data - An array of matchups for the day.
 * @returns {Object} - Object containing the earliest and latest times from the matchups data.
 */
function getEarliestAndLatestTimes(data) {
	const earliestCron = data[0].cronstart
	const latestCron = data[data.length - 1].cronstart

	const earliestTime = cronDate(earliestCron)
	const latestTime = cronDate(latestCron)

	return { earliestTime, latestTime }
}

/**
 * Calculates the Cron Ranges for the API calls.
 * @function calculateCronRanges
 * @param {Object} earliestTime - Object containing the earliest time from the matchups data.
 * @param {Object} latestTime - Object containing the latest time from the matchups data.
 * @returns {Object} - Object containing the Cron Ranges for the API calls.
 * @example
 * returns { earliestRange: '* 8 1 1 0-4', latestRange: '* 8 1 1 0-4' }
 */
function calculateCronRanges(earliestTime, latestTime) {
	const { earliestHour, latestHour, oneGame, cMonth } = getGameHours(
		earliestTime,
		latestTime,
	)

	const earliestRange = getCronRange(
		earliestHour,
		cMonth,
		earliestTime.dayOfMonth,
		earliestTime.dayOfWeek,
		'0-4',
	)

	const latestRange = oneGame
		? getCronRange(
				latestHour,
				cMonth,
				latestTime.dayOfMonth,
				latestTime.dayOfWeek,
		  )
		: getCronRange(
				latestHour,
				cMonth,
				latestTime.dayOfMonth,
				latestTime.dayOfWeek,
				'0-4',
		  )

	return { earliestRange, latestRange }
}

function getGameHours(earliestTime, latestTime) {
	const earliestHour = earliestTime.hour
	const latestHour = latestTime.hour
	const oneGame = earliestHour === latestHour
	const cMonth = earliestTime.month

	return { earliestHour, latestHour, oneGame, cMonth }
}
/**
 * Returns an object with cron range settings for a given hour, day, and month.
 * @function getCronRange
 * @param {number} hour - The hour of the day (0-23).
 * @param {number} month - The month of the year (1-12).
 * @param {number} dayOfMonth - The day of the month (1-31).
 * @param {number} dayOfWeek - The day of the week (0-6, where 0 is Sunday).
 * @param {string} range - The range of hours to include in the cron job (default is 4 hours starting from the given hour).
 * @returns {object} - An object with cron range settings.
 */

function getCronRange(
	hour,
	month,
	dayOfMonth,
	dayOfWeek,
	range = `${hour}-${hour + 4}`,
) {
	return {
		cronHour: hour >= 21 ? '0-4' : range,
		newDate: '',
		month,
		dayOfMonth,
		dayOfWeek,
	}
}

/**
 * Parses a cron string and returns an object with date-related properties.
 *
 * @function cronDate
 * @param {string} cronStr - A cron string in the format "0 0 12 * * *"
 * @returns {Object} - An object containing date-related properties, including the parsed cron start date and month, hour, minute, day of the month, and day of the week.
 */
function cronDate(cronStr) {
	const parsed = cronParser.parseExpression(cronStr)
	const nextInter = parsed.next()
	let date = nextInter.getTime()
	date = format(date, 'M-HH-mm-dd-ee')

	return {
		date: nextInter,
		cronstart: cronStr,
		month: date.split('-')[0],
		hour: date.split('-')[1],
		minute: date.split('-')[2],
		dayOfMonth: date.split('-')[3],
		dayOfWeek: date.split('-')[4],
	}
}
