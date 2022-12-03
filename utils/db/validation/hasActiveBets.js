import { FileRunning } from '#botClasses/FileRunning'
import { db } from '#db'
import { LIVEBETS } from '#config'
/**
 * @module hasActiveBets -
 * Queries the database to validate any active user bets.
 * @param {integer} userid - The user ID of the user we are validating.
 * @returns {obj} The result of the query regarding the user's active bets. If bets are found, they are returned in an array of rows.
 * @references {@link listBets.js} - This module will resolve the promise within hasActiveBet.js
 */
export function hasActiveBets(userid) {
    new FileRunning('queryUserBets')
    return db.any(`SELECT * FROM "${LIVEBETS}" WHERE userid = $1`, [userid])
}
