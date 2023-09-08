import {
	parseISO,
	addHours,
	isLastDayOfMonth,
	getDaysInMonth,
	addDays,
} from 'date-fns'
/**
 * @module cronRangeGenerator
 * @summary Generate a set of Cron Ranges based on the provided array of matchups.
 * @param {array} matchesArr - An array  containing the matchups for today
 *
 * @description This function assists the application in checking for completed games within a specific time frame to
 * minimize the number of API calls called daily.
 * The cron ranges are created by parsing the `startTime` from each game object in the provided array of matchups.
 * The times from `the-odds-api` are by default in ISO 8601 format. This function will determine the earliest and the latest games (start and end of the arr) and then reference today\'s date to ensure that the cron ranges generated are between the earliest and latest games.
 * Games that start at 8 PM (20:00) or later will have the 2nd cron range to go into the following day, early-AM hours.
 *
 * Example of `matchesArr`
 * @example
 * [
 * 			'2022-01-01T00:00:00.000Z',
 * 			'2022-01-01T03:00:00.000Z',
]
 * 
 */

export default function cronRangeGenerator(matches) {
	const earliestMatch = matches[0]
	const latestMatch = matches[matches.length - 1]
	const earliestMatchStart = parseISO(earliestMatch)
	const latestMatchStart = parseISO(latestMatch)

	// Add time to both earliest and latest games to base API Calls around them
	// We add time to base it around when the game will be ending
	const earliestProcessed = addHours(
		earliestMatchStart,
		1,
	)
	const latestProcessed = addHours(latestMatchStart, 3)

	const earliestHour = earliestProcessed.getHours()
	let latestHour = latestProcessed.getHours()

	// # Check if both dates are within the same day
	const earliestDay = earliestMatchStart.getDate()
	let latestDay = latestMatchStart.getDate()
	// Dates of processed
	const dateEarliestProcessed =
		earliestProcessed.getDate()
	const dateLatestProcessed = latestProcessed.getDate()

	const isSameDay =
		earliestDay === latestDay &&
		dateEarliestProcessed === dateLatestProcessed

	const interval = '*/5'
	let month = `${new Date().getMonth() + 1}`

	let range2 = null

	// ? Games past 8 PM => End 1st range @ Midnight
	// ? 2nd range gets created: Midnight - 3 AM
	if (latestHour >= 20 || !isSameDay) {
		latestDay = earliestDay + 1
		// Make date object from latestDay
		const dateObj = new Date()
		dateObj.setDate(earliestDay)
		const lastDay = lastDayOfMonth(new Date(dateObj))
		if (lastDay === true) {
			// # Get next month via date-fns
			month = `${new Date().getMonth() + 2}`
			// # latestDay should be first of the month
			latestDay = 1
		}
		latestHour = 23
		range2 = `${interval} 0-3 ${latestDay} ${month} *`
	}

	const hourRange = `${earliestHour}-${latestHour}`
	const range1 = `${interval} ${hourRange} ${earliestDay} ${month} *`

	return { range1, range2 }
}

/**
 * Check if the input date is the last day of the month using date-fns
 * @param {Date} date
 * @return {boolean} True if the date is the last day of the month, otherwise false
 */
function lastDayOfMonth(date) {
	const currentIsLast = isLastDayOfMonth(date)
	// Check if incrementing the date plus 1 day will result in the last day of the month
	const incremented = addDays(date, 1)
	// # Get # of days for the month based on date
	const daysInMonth = getDaysInMonth(date)
	// Check if incrementing it would be higher than any date in the month
	const incrementedIsLast = incremented > daysInMonth
	return currentIsLast || incrementedIsLast
}
