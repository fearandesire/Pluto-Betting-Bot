import { FileRunning } from '../bot_res/classes/FileRunning.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { QuickError } from '../bot_res/send_functions/embedReply.js'
import { isDuplicateBet } from './isDuplicateBet.js'

/**
 * @module verifyDuplicateBet - Handles promise for validation of a duplicate bet when invoked via {@link placeBet.js}
 * @param {integer} userid - The user's ID
 * @param {string} betOnTeam - The team the user is betting on
 * @param {obj} message - The message object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @references
 * - {@link isDuplicateBet} - This function is called to query the database and validate if there is an existing bet based on our user input.
 * - {@link placeBet.js} - Invoked via placeBet.js
 */
//? Check if the user is duplicating their existing bet

export async function verifyDupBet(message, userid, matchId) {
	new FileRunning(`verifyDupBet`)
	await isDuplicateBet(userid, matchId).then((data) => {
		if (data) {
			QuickError(message, `You have already placed a bet on this match`)
			throw Log.Error(
				`[verifyDupBet.js] User ${userid} has already placed a bet on Matchup: ${matchId} - ended event`,
			)
		}
		return
	})
}
