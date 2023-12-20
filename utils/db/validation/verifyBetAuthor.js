import { Log, QuickError } from '@pluto-core-config'

import { retrieveBetAuthor } from '@pluto-validate/retrieveBetAuthor.js'
import { NoDataFoundError } from '../../bot_res/classes/Errors.js'

/**
 * @module verifyBetAuthor -
 * This module verifies the author of the bet being requested to be cancelled / manipulated (via retrieveBetAuthor)
 *
 * When the data is returned from retrieveBetAuthor, we check:
 * - If the bet exists in the DB
 * - If the userid matches the userid of the user who created the bet
 * - If the betid matches the betid of the bet being requested to be cancelled / manipulated (failsafe)
 * @param {integer} message - The Discord message object. Used to reply to the user.
 * @param {integer} userid - The Discord user Id of who called the command.
 * @param {integer} betid - The Id of the bet being requested to be cancelled / manipulated.
 * @returns N/A - Will throw an error if the bet does not belong to the user.
 */

export async function verifyBetAuthor(
	message,
	userid,
	betid,
	interactionEph,
) {
	await retrieveBetAuthor(userid, betid)
		.then(async (result) => {
			if (result.length === 0) {
				Log.Red(
					`[verifyBetAuthor.js] Error: Unable to locate bet ${betid} for deletion/modification. -- requested by: ${userid}`,
				)
				return false
			}
			Log.Green(
				`[verifyBetAuthor.js] Successfully located bet ${betid} for deletion/modification. -- requested by: ${userid}`,
			)
			return true
		})
		.catch(() => {
			QuickError(
				message,
				`Unable to locate bet: #**${betid}** for deletion. *Either this is not your bet, or the bet does not exist.*`,
				interactionEph,
			)
			throw new NoDataFoundError(
				`Unable to retrieve any data for bet ${betid} in the database`,
				'verifyBetAuthor.js',
			)
		})
}
