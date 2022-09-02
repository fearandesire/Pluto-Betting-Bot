import { db } from '../../Database/dbindex.js'

/**
 * @module isDuplicateBet -
 * ⁡⁣⁣⁢Query the DB table 'activebets' with the team the user wishes to bet on. Used to determine if the user has already placed a bet on that team. Resolves with .𝙩𝙝𝙚𝙣 outside of this function (See: **{@link verifyDuplicateBet.js}**)⁡
 * @param {integer} userid - The user's ID
 * @param {string} teamid - The team the user has input to bet on, which we use to validate it's existence in the database.
 * @returns {obj} The result of the query.
 * @references {@link verifyDuplicateBet.js} - Resolves promise if data is found, rejects promise if data is not found.
 */
export function isDuplicateBet(userid, teamid) {
	return db.oneOrNone(
		`SELECT * FROM activebets WHERE userid = $1 AND teamid = $2`,
		[userid, teamid],
	)
}
