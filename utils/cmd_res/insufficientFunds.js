import { FileRunning } from '../bot_res/classes/FileRunning.js'
import { db } from '../../Database/dbindex.js'

/**
 * @module insufficientFunds -
 * ⁡⁣⁣⁢Query the DB via ***'currency'*** table.⁡
 * ⁡⁣⁣⁢- **This function's promise is resolved outside of the function (verifyFunds.js)**⁡
 * @param message - The message object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @param userid - The user's ID.
 * @returns {integer} We retrieve the user's balance as an integer as we have directly accessed the cell with the arrow function. See: ***{@link http://vitaly-t.github.io/pg-promise/ pg-promise}***
 * @references
 * - {@link verifyFunds.js} - This module is resolved in verifyFunds.js - a function to check if the user has sufficient funds to bet.
 */

export function insufficientFunds(message, userid) {
	new FileRunning(`insufficientFunds`)
	return db.oneOrNone(
		'SELECT * FROM currency WHERE userid = $1',
		[userid],
		(a) => a.balance,
	)
}
