import { db } from '#db'
import { PROFILES } from '#serverConf'

/**
 * Return the user's balance - Directly retrieves information without many params
 */

export async function getBalance(userid) {
	const userBal = await db.oneOrNone(
		`SELECT * FROM "${PROFILES}" WHERE userid = $1`,
		[userid],
	)
	return userBal.balance
}
