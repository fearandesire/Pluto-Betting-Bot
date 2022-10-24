import { db } from '#db'

/**
 * @module reqLeaderboard
 * Pull and map all data from the "NBAcurrency" table in the DB - sort by the highest values to the lowest.
 */

export async function reqLeaderboard() {
    return await db.map(
        `SELECT userid,balance FROM currency ORDER BY balance DESC NULLS LAST`,
        ['123'],
        (lbObj) => {
            return lbObj
        },
    )
}
