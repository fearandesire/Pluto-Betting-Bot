import { isDuplicateBet } from '@pluto-validate/isDuplicateBet.js'
import { QuickError } from '@pluto-embed-reply'
import { Log } from '@pluto-internal-logger'
import PendingBetHandler from './pendingBet.js'

/**
 * @module verifyDuplicateBet - This module is used to verify if a new bet being placed is possibly a duplicate of an existing one.
 * @param {integer} userid - The user's ID
 * @param {string} betOnTeam - The team the user is betting on
 * @param {obj} message - The message object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 @returns {boolean} - False if the bet is not a duplicate, throws error otherwise
*/
// ? Check if the user is duplicating their existing bet

export async function verifyDupBet(
	message,
	userid,
	matchApiId,
) {
	await isDuplicateBet(userid, matchApiId).then(
		async (data) => {
			if (data) {
				QuickError(
					message,
					`You have already placed a bet on this match`,
				)
				// # delete from pending
				await PendingBetHandler.deletePending(
					userid,
				)
				throw Log.Error(
					`[verifyDupBet.js] User ${userid} has already placed a bet on Matchup: ${matchApiId} - ended event`,
				)
			} else {
				return false
			}
		},
	)
}
