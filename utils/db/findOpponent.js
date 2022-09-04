import { Log, _, container } from '#config'

import { db } from '#db'

/**
 * @module findOpponent
 * Locate the opponent for a team via matching the team name in the activematchups table in the database
 * @param {string} firstTeam - The team that will we use to search the opponent for
 * @return {string} Returns the name of the opponent team
 */

export function findOpponent(message, firstTeam) {
    return db
        .tx('findOpponent', async (t) => {
            return await t.oneOrNone(
                `SELECT * from activematchups WHERE teamone = $1 OR teamtwo = $1`,
                [firstTeam],
            )
        })
        .then((data) => {
            Log.Yellow(`[findOpponent.js] Located matching row`)
            container.oppTeam = ''
            _.map(data, function (value, key) {
                console.log(`${key}: ${value}`)
                if (key.teamone === firstTeam) {
                    container.oppTeam = key.teamtwo
                } else if (key.teamtwo === firstTeam) {
                    container.oppTeam = key.teamone
                }
            })
            return container.oppTeam
        })
}
