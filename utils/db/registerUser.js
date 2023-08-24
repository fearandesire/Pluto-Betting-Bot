import { QuickError, embedReply } from '#embed'

import { TodaysDate } from '#cmdUtil/TodaysDate'
import { db } from '#db'
import { registerUserLog } from '#Logger'
import { CURRENCY } from '#config'

/**
 * Create a new user in the database. By default, we will store their userID (required) and their default balance: 100 (optional)
 * Balance is an optional argument as the default value of 'balance' will be set to 100.
 * @param {integer | string} userid - The ID of the user to be created.
 */

export async function registerUser(
	message,
	userid,
	inform,
	interactionEph,
) {
	db.tx(`registerUser-Transaction`, async (t) => {
		const findUser = await t.oneOrNone(
			`SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
			[userid],
		)
		if (!findUser) {
			// Log.BrightBlue(`[registerUser.js] User ${userid} is not in the database, creating user`)
			registerUserLog.info(
				`Created user account for ${userid} in the database.`,
			)
			const isSilent = !!interactionEph
			const embedObj = {
				title: `Welcome to Pluto!`,
				description: `Successfully created an account for you - you'll start with $100 dollars.`,
				color: 'GREEN',
				footer: `Pluto - Developed by FENIX#7559`,
				silent: isSilent,
			}
			await embedReply(message, embedObj)
			return t.any(
				`INSERT INTO "${CURRENCY}" (userid, balance, registerdate) VALUES ($1, $2, $3) RETURNING *`,
				[userid, '100', TodaysDate()],
			)
		}
		registerUserLog.info(
			`User ${userid} is in the database, skipping creation`,
		)
		if (inform === true) {
			QuickError(
				message,
				`You are already registered!`,
				interactionEph,
			)
			return
		}
		return findUser
	}).catch((error) => {
		registerUserLog.error(error)
	})
}
