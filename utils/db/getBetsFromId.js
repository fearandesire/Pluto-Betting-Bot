import { FileRunning } from '#FileRun'
import { db } from '#db'

/**
 * @module getBetsFromId
 * Retrieve all user bets that match the provided matchid
 * @param {integer} searchID - A match ID that we will search for
 *
 */

export function getBetsFromId(searchID) {
    new FileRunning(`getBetsFromId`)
    return db.many(`SELECT * FROM activebets WHERE matchid = $1`, [searchID])
}
