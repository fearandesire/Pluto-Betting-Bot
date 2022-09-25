import { FileRunning } from '#botClasses/FileRunning'
import { db } from '#db'

/**
 * @module hasActiveBets -
 * Queries the database to validate any active user bets.
 * ! It's important to note that we are calling the 'activebets' table, not the 'betslips' table. Long term: this may be re-visited.
 * @param {integer} userid - The user's ID
 * @returns {obj} The result of the query regarding the user's active bets. If bets are found, they are returned in an array of rows.
 * @references {@link listBets.js} - This module will resolve the promise within hasActiveBet.js
 */
export function hasActiveBets(userid) {
	new FileRunning('queryUserBets')
	return db.any(`SELECT * FROM activebets WHERE userid = $1`, [userid])
}
