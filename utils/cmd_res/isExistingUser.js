import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

//? identify if the user exists in the database

export function isExistingUser(userID) {
	return db
		.oneOrNone(`SELECT * FROM currency WHERE userid = $1`, [userID])
		.then((data) => {
			if (data) {
				Log.Green(`[isExistingUser.js] User ${userID} exists in the database`)
				return true
			} else {
				Log.Red(
					`[isExistingUser.js] User ${userID} does not exist in the database`,
				)
				return false
			}
		})
		.catch((err) => {
			Log.Error(`[isExistingUser.js] Error checking for active bet\n${err}`)
			return false
		})
}
