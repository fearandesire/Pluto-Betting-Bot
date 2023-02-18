import { db } from '#db'
import { PROFILE } from "#config"
/**
 * @module quickBalance
 * Return the user's balance - intended for DM use for bet winners
 */

export async function quickBalance(userid) {
    var userBal = await db.oneOrNone(
        `SELECT balance FROM "${PROFILE}" WHERE userid = $1`,
        [userid],
    )
    return userBal.balance
}
