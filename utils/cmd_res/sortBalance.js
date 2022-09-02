//TODO: Eliminate 'have enough credits' check as we have an official module to handle that now - verifyFunds.js

import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

/**
 * @module sortBalance - This function is used to subtract a users bet amount from their current balance.
 * @summary - When a user places a bet, the amount they want to bet will be subtracted from their current balance.
 * In order to do such, we first query for their balance into the 'currency' table. Afterwords, we ensure that the user has enough funds to bet.
 * If they do, we subtract the bet amount from their balance and update the DB.
 * If they dont, we throw an error and tell them they dot have enough funds.
 * @param {obj} message - The mesage object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @param {integer} userid - The user's discord id
 * @param {integer} betamount - The amount of credits the user is betting
 * @references
 * - {@link confirmBet.js} - Invoked from confirmBet.js - a function that asks the user to confirm their bet
 */
export function sortBalance(message, userid, betamount) {
	//? Using DB transactions to make more than 1 query.
	db.tx('sortBalance-Transaction', async (t) => {
		const currentBalance = await t.oneOrNone(
			'SELECT * FROM currency WHERE userid = $1',
			[userid],
			(a) => a.balance,
		)
		//? Oriiginally this was the setup to prevent users from betting more than they have
		//? I've placed a check for this prior in the command handler [placebet.js], but leaving it here for now.
		//? Now we check funds with verifyFunds.js
		if (parseInt(currentBalance) < parseInt(betamount)) {
			Log.Error(
				`[sortBalance.js] User ${userid} does not have enough credits to bet ${betamount}\n Current Balance:`,
			)
			Log.BrightBlue(JSON.stringify(currentBalance))
			message.reply(
				`You do not have enough credits to bet ${betamount} credits.`,
			)
			return
		}
		const newBalance = parseInt(currentBalance) - parseInt(betamount)
		return t.any(
			'UPDATE currency SET balance = $1 WHERE userid = $2 RETURNING *',
			[newBalance, userid],
		)
	}).then((data) => {
		if (data) {
			//? Data here returns in array format, so accessing first result (and should be the only result as its 1 identity per user)
			//? Not all pg-promise queries return an array, so be sure to check if data is an array before accessing it via pg-promise docs
			Log.Green(
				`[sortBalance.js] User ${userid} has ${data[0].balance} credits`,
			)
			Log.BrightBlue(JSON.stringify(data))
			Log.Green(
				`[sortBalance.js] Successfully subtracted ${betamount} credits from user ${userid}. New Balance: ${data[0].balance}`,
			)
			return data[0].balance
		}
	})
}
