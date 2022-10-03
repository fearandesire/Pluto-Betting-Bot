import { db } from '#db'

/**
 * @module removeUserProfile
 * Remove a user from the currency table - Used to removing users who are no longer in the server.
 */

export async function removeUserProfile(userid) {
    return db.tx('removeUserProfile', async (t) => {
        await t.oneOrNone(`DELETE FROM currency WHERE userid = $1`, [userid])
    })
}
