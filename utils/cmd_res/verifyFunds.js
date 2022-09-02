import { FileRunning } from '../bot_res/classes/FileRunning.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { embedReply } from '../bot_res/send_functions/embedReply.js'
import { insufficientFunds } from './insufficientFunds.js'

/**
 * @module verifyFunds.js -
 * Handles the verification of funds for a user via our DB query promise with {@link insufficientFunds}
 * @param {obj} message - The message object from discord.js
 * @param {integer} user - The user's ID
 * @param {integer} betamount - The amount of credits the user is trying to bet.
 * @param {integer} teamid - The team that the user is betting on.
 * @references {@link placeBet.js} - Invoked via placeBet.js
 */

export async function verifyFunds(message, user, betamount, teamid) {
	new FileRunning(`verifyFunds`)
	//? We are able to retrieve the information from DB in a typical promise response.
	//? This is because we have placed the promise catching / resolving aka .then() outside of the function [insufficientFunds.js] itself.
	await insufficientFunds(message, user).then((balance) => {
		if (balance < betamount) {
			var embedcontent = {
				title: 'Insufficient Funds',
				description: `You do not have sufficient funds to place this bet. Your current balance is **${balance} credits**`,
				color: 'RED',
			}
			embedReply(message, embedcontent)
			throw Log.Error(
				`User ${user} does not have sufficient funds to place their desired bet ${betamount} on ${teamid}.\n Retrieved Balance: ${balance}`,
			)
		}
		return
	})
}
