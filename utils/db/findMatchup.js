import { db } from '#db'

/**
 * @module findMatchup
 * Locate the matchup in activematchups table from the DB via searching for a matching team name
 * @param {string} firstTeam - The team that will we use to search the opponent for
 * @return {obj} Returns the object of the row containing the matched team
 */

export function findMatchup(message, firstTeam) {
    return db.tx('findMatchup', async (t) => {
        return await t.oneOrNone(
            `SELECT * from activematchups WHERE teamone = $1 OR teamtwo = $1`,
            [firstTeam],
        )
    })
}
