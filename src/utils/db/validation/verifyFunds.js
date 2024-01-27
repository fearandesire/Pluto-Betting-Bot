import { embedReply } from '@pluto-embed-reply'
import { Log } from '@pluto-internal-logger'
import { FileRunning } from '../bot_res/classes/FileRunning.js'
import { fetchBalance } from './fetchBalance.js'
import PendingBetHandler from './pendingBet.js'

/**
 * @module verifyFunds.js -
 * Handles the verification of funds for a user via our DB query promise with {@link fetchBalance}
 * @param {obj} message - The message object from discord.js
 * @param {integer} user - The user's ID
 * @param {integer} betamount - The amount of dollars the user is trying to bet.
 * @param {integer} teamid - The team that the user is betting on.
 * @references {@link placeBet.js} - Invoked via placeBet.js
 */

export async function verifyFunds(
	message,
	user,
	betamount,
	teamid,
) {
	new FileRunning(`verifyFunds`)
	// ? We are able to retrieve the information from DB in a typical promise response.
	// ? This is because we have placed the promise catching / resolving aka .then() outside of the function [fetchBalance.js] itself.
	await fetchBalance(message, user).then(
		async (balance) => {
			if (balance < betamount) {
				const embedcontent = {
					title: 'Insufficient Funds',
					description: `You do not have sufficient funds to place this bet. Your current balance is **${balance} dollars**`,
					color: 'RED',
				}
				await embedReply(message, embedcontent)
				// # clear pending bet progress
				await PendingBetHandler.deletePending(user)
				throw Log.Error(
					`User ${user} does not have sufficient funds to place their desired bet ${betamount} on ${teamid}.\n Retrieved Balance: ${balance}`,
				)
			}
		},
	)
}
