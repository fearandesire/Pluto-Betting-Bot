import db from '@pluto-db'
import { LIVEBETS } from '@pluto-core-config'

/**
 * @module retrieveBetAuthor -
 * This function will query the database and retrieve the data from live bets table via the user and bet IDs.
 * Used to authenticate the user identity of the bet being requested to be cancelled / manipulated.
 * @param {integer} userid - The userid of the user who created the bet.
 * @param {integer} betid - the id of the bet
 * @returns {Array} An array of objects containing the bet data found (if any)
 */

export function retrieveBetAuthor(userid, betid) {
	return db.many(
		`SELECT * FROM "${LIVEBETS}" WHERE userid = $1 AND betid = $2`,
		[userid, betid],
	)
}
