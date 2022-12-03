import { db } from '#db'
import { LIVEMATCHUPS } from '#config'

/**
 * @module findMatchup
 * Locate the matchup in matchups table from the DB via searching for a matching team name
 * @param {string | integer} teamOrId - The team name or ID that we will search for
 * @return {obj} Returns the object of the row containing the matched team
 */

export function findMatchup(teamOrId) {
    console.log(`Searching for match containing: ${teamOrId}`)
    if (typeof teamOrId === 'string') {
        return db.tx('findMatchup', async (t) => {
            return await t.oneOrNone(
                `SELECT * from "${LIVEMATCHUPS}" WHERE teamone = $1 OR teamtwo = $1`,
                [teamOrId],
            )
        })
    } else if (typeof teamOrId === 'number') {
        return db.tx('findMatchup', async (t) => {
            return await t.oneOrNone(
                `SELECT * from "${LIVEMATCHUPS}" WHERE matchid = $1`,
                [teamOrId],
            )
        })
    }
}
