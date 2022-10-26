import { Log, NBA_ACTIVEMATCHUPS, _ } from '#config'

import { db } from '#db'
import { resolveToday } from '#dateUtil/resolveToday'

/**
 * @module isGameDay
 * Query database and check if there is any 'dateofmatchup' that matches today's date.
 * @returns {boolean} true if there is a game today, false if there is not.
 */

export async function isGameDay() {
    var todaySlashed = await new resolveToday().todayFullSlashes
    return await db
        .manyOrNone(
            `SELECT * FROM "${NBA_ACTIVEMATCHUPS}" WHERE dateofmatchup = $1`,
            [todaySlashed],
        )
        .then(async (data) => {
            if (_.isEmpty(data)) {
                Log.Red(`No active matchups found in the database.`)
                return false
            } else {
                Log.Green(`Active matchups found in the database.`)
                return true
            }
        })
}
