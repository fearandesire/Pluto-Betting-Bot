import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

export async function registeruser(message, inputuserid) {
	Log.Yellow(`[register.js] Running register!`)

	db.tx('register-Transaction', async (t) => {
		//? Search for user via their Discord ID in the database
		const findUser = await t.oneOrNone(
			'SELECT * FROM currency WHERE userid = $1',
			[inputuserid],
		) //
		if (!findUser) {
			Log.BrightBlue(
				`[register.js] User ${inputuserid} is not in the database, creating user`,
			)
			//? add user to DB & process claim in 1 query to minimize DB load
			message.reply(
				`I see this is your first time using Pluto, welcome! I've created an account for you and completed your daily claim request of 100 credits yessirrr.`,
			)
			return t.any(
				'INSERT INTO currency (userid, balance) VALUES ($1, $2) RETURNING *',
				[inputuserid, '100'],
			)
		} else if (findUser.userid === inputuserid) {
			Log.BrightBlue(
				`[register.js] User ${inputuserid} is in the database, but has never used the claim command. Processing claim`,
			)
			message.reply(`You already have an account.`)
		}
	})
}
