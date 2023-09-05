import _ from 'lodash'
import { parseISO, isBefore, addHours } from 'date-fns'
import { IsoManager } from '#iso'

/**
 * Creates Cron Jobs to make API Calls to check for completed games to close bets
 */

export default async function completedChecks(dates) {
	// Place every start_date into an array
	const earliestDate = findEarliestDate(dates)
	// Add 1 hour to the date
	const betsHeartbeat = addHours(earliestDate, 1)
	// Return the time in Cron via IsoManager
	const isoManager = new IsoManager(betsHeartbeat)
	const cronTime = isoManager.cron
	return cronTime
}

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
