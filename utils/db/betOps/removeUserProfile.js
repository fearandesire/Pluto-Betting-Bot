import { db } from '#db'
import { CURRENCY } from '#config'
/**
 * @module removeUserProfile
 * Remove a user from the currency/profile table - Used to removing users who are no longer in the server.
 */

export async function removeUserProfile(userid) {
    return db.tx('removeUserProfile', async (t) => {
        await t.oneOrNone(`DELETE FROM "${CURRENCY}" WHERE userid = $1`, [userid])
    })
}
