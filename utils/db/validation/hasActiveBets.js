import _ from 'lodash'
import { db } from '#db'
import { LIVEBETS } from '#config'
import PlutoLogger from '#PlutoLogger'
/**
 * Queries the database to validate any active user bets.
 * @param {integer} userid - The user ID of the user we are validating.
 * @returns {object} The result of the query regarding the user's active bets. If bets are found, they are returned in an array of rows.
 * @references {@link listBets.js} - This module will resolve the promise within hasActiveBet.js
 */
export async function hasActiveBets(userid) {
	try {
		const activeForUser = await db.any(
			`SELECT * FROM "${LIVEBETS}" WHERE userid = $1`,
			[userid],
		)
		if (_.isEmpty(activeForUser)) {
			return false
		}
		return true
	} catch (err) {
		await PlutoLogger.log({
			id: 3,
			description: `Ran into a problem when checking the active bets for ${userid}\nError: ${err?.message}`,
		})
		return false
	}
}
