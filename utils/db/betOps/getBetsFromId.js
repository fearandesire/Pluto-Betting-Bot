import { FileRunning } from '#FileRun'
import { Log, LIVEBETS } from '#config'
import { db } from '#db'

/**
 * @module getBetsFromId
 * Retrieve all user bets that match the provided matchid
 * @param {integer} searchID - A match ID that we will search for
 *
 */

export async function getBetsFromId(searchID) {
    await Log.Red(
        `[getBetsFromId.js] getBetsFromId called with searchID: ${searchID}`,
    )
    new FileRunning(`getBetsFromId`)
    return await db.manyOrNone(`SELECT * FROM "${LIVEBETS}" WHERE matchid = $1`, [
        searchID,
    ])
}
