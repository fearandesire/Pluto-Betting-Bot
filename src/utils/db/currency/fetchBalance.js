import db from '@pluto-db'
import { CURRENCY } from '@pluto-core-config'
/**
 * @module fetchBalance -
 * ⁡⁣⁣Retrieve balance for user from the database⁡
 * @param message - The Discord Message Object
 * @param userid - The user's ID.
 * @returns {integer} User Balance
 */

export function fetchBalance(message, userid) {
	return db.oneOrNone(
		`SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
		[userid],
		(a) => a.balance,
	)
}
