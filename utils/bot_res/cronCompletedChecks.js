import _ from 'lodash'
import {
	parseISO,
	isBefore,
	addHours,
	getDate,
} from 'date-fns'

/**
 * Creates Cron Jobs to make API Calls to check for completed games to close bets
 * An hour is added to the earliest game start time to reduce the amount of API calls made
 * @param {array} dates - An array of dates
 * @return {string} Cron Job String (e.g '0 11 5 9 2')
 */

export default async function completedChecks(dates) {
	// Place every start_date into an array
	const earliestDate = findEarliestDate(dates)
	// Add 2 hours to the date
	const betsHeartbeat = addHours(earliestDate, 1)
	// Get hour
	const hour = betsHeartbeat.getHours()
	const hourStr = `${hour}-23`
	const day = getDate(betsHeartbeat)
	const month = betsHeartbeat.getMonth()
	const cronStr1 = `*/5 ${hourStr} ${day} ${month} *`
	// Return the time in Cron via IsoManager
	return cronStr1
}

/**
 * Finds the earliest date from an array of dates.
 * @param {Array} dates - An array of dates to search through.
 * @return {Date} The earliest date found.
 */
function findEarliestDate(dates) {
	return _.reduce(
		dates,
		(earliest, current) => {
			const currentParsed = parseISO(current)
			return isBefore(currentParsed, earliest)
				? currentParsed
				: earliest
		},
		parseISO(dates[0]),
	)
}
