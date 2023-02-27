import { db } from '#db'
import { PROFILES } from '#env'
/**
 * @module quickBalance
 * Return the user's balance - intended for DM use for bet winners
 */

export async function quickBalance(userid) {
	const userBal = await db.oneOrNone(
		`SELECT balance FROM "${PROFILES}" WHERE userid = $1`,
		[userid],
	)
	return userBal.balance
}
