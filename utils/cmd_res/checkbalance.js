//See DB index.Js And ProcessClaim.js

import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

export async function checkbalance(inputuserid, message, notuser) {
	Log.Yellow(`[checkbalance.js] Running checkbalance!`)
	Log.Border()
	const notusercheck = notuser || false //? if another user is being called on, this is true. Otherwise, it is false.
	db.tx('checkbalance-Transaction', async (t) => {
		const findings = await t.oneOrNone(
			'SELECT * FROM currency WHERE userid = $1',
			[inputuserid],
		)
		//? Checks if user not in DB and not Self user ( whoever is calling the command )
		if (!findings && notusercheck == false) {
			message.reply('User has no Betting history')
			Log.Error('User has no Betting history')
			return
		}

		if (!findings) {
			//? if user is not in DB but is calling upon their own balance "!balance"
			Log.BrightBlue(
				`[checkbalance.js] User ${inputuserid} is not in the database, creating user`,
			)

			message.reply(
				`I see this is your first time using Pluto, welcome! I've created an account for you and assigned 100 credits.`,
			)
			return t.any(
				'INSERT INTO currency (userid, balance) VALUES ($1, $2) RETURNING *',
				[inputuserid, '100'],
			)
		}
		if (findings.userid === inputuserid) {
			//? User in database return balance
			const usersbalance = findings.balance
			message.reply(`Balance: ${usersbalance}`)
			Log.BrightBlue(usersbalance)
		}
	})
		//? Catching connection errors, not database data/table/error errors.
		.catch((error) => {
			Log.Border(`[checkbalance.js] Something went wrong...`)
			Log.Error(error)
			return
		})
}
