import { db } from '#db'
import { LIVEBETS } from '#config'

/**
 * @module removeFromActive
 * Remove a bet from the active bets table - Used to removing bets from users who are no longer in the server.
 */

export async function removeFromActive(userid, betid) {
    return db.tx('removeFromActive', async (t) => {
        await t.oneOrNone(
            `DELETE FROM "${LIVEBETS}" WHERE userid = $1 AND betid = $2`,
            [userid, betid],
        )
    })
}
