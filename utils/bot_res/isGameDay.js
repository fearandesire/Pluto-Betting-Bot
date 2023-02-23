import { Log, LIVEMATCHUPS, _ } from '#config'

import { db } from '#db'
import { resolveToday } from '#dateUtil/resolveToday'

/**
 * @module isGameDay
 * Query database and check if there is any 'dateofmatchup' that matches today's date.
 * @returns {boolean} true if there is a game today, false if there is not.
 */

export async function isGameDay() {
    try {
        const todaySlashed = await new resolveToday().todayFullSlashes
        const query = {
            text: `SELECT * FROM "${process.env.LIVEMATCHUPS}" WHERE dateofmatchup = $1`,
            values: [todaySlashed],
        }
        const result = await db.query(query)
        const hasActiveMatchups = result.rowCount > 0
        if (hasActiveMatchups) {
            Log.Green(`[isGameDay] Active matchups found in the database.`)
        } else {
            Log.Red(`No active matchups found in the database.`)
        }
        return hasActiveMatchups
    } catch (error) {
        Log.Error(`[isGameDay] Error checking for active matchups: ${error}`)
        throw error
    }
}
