import db from '@pluto-db'
import { LIVEBETS } from '@pluto-core-config'

/**
 * @module isDuplicateBet -
 * ⁡⁣⁣⁢Query the DB table live bets with the team the user wishes to bet on. Used to determine if the user has already placed a bet on that team. Resolves with .𝙩𝙝𝙚𝙣 outside of this function (See: **{@link verifyDuplicateBet.js}**)⁡
 * @param {integer} userid - The user's ID
 * @param {integer} matchupId - The team the user has input to bet on, which we use to validate it's existence in the database.
 * @returns {obj} The result of the query.
 * @references {@link verifyDuplicateBet.js} - Resolves promise if data is found, rejects promise if data is not found.
 */

export function isDuplicateBet(userid, matchupId) {
	return db.oneOrNone(
		`SELECT * FROM "${LIVEBETS}" WHERE userid = $1 AND matchid = $2`,
		[userid, matchupId],
	)
}
