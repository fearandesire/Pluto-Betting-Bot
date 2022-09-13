import { db } from '../../Database/dbindex.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'

/**
 * @module giveBalance - Give money / credits to a specified user
 * @param {integer} message - The Discord Message Object
 * @param {integer} inputuserid - The user's Discord ID
 * @param {integer} transferammount - How much to give the user
 */

export async function giveBalance(message, inputuserid, transferammount) {
	Log.Yellow(`[transfer.js] Running transfer!`)

	db.tx('processClaim-Transaction', async (t) => {
		const findUser = await t.oneOrNone(
			'SELECT * FROM currency WHERE userid = $1',
			[inputuserid],
		)
		var currentBalance = findUser.balance
		var updatebalance = parseInt(currentBalance) + parseInt(transferammount)
		message.reply(`<@${inputuserid}> has been sent ${transferammount} credits.`)
		return t.any(
			'UPDATE currency SET balance = $1 WHERE userid = $2 RETURNING *',
			[updatebalance, inputuserid],
		)
	})
}
