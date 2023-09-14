import { format } from 'date-fns'
import { db } from '#db'
import { _ } from '#config'
import { LIVEMATCHUPS, PENDING } from '#serverConf'
/**
 * Completely wipes clear pending bets
 */
export async function clearPendingBets() {
	await db.none(`DELETE FROM "${PENDING}"`)
}

/**
 * @module fetchTodaysMatches
 * Fetches all the matches scheduled for today from the database
 * @returns {array} - An array of objects containing the matchups for today
 */
export async function fetchTodaysMatches() {
	const gamesOrdered = await db.manyOrNone(
		`SELECT * from "${LIVEMATCHUPS}" ORDER BY start ASC`,
	)
	const td = new Date()
	const today = format(td, 'MM/dd/yyyy')

	const todaysMatches = _.filter(
		gamesOrdered,
		async (match) => {
			const matchDate = match.dateofmatchup.toString()
			if (matchDate === today) {
				return true
			}
		},
	)
	return todaysMatches
}
