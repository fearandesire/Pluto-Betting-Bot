import { FileRunning } from '#FileRun'
import { db } from '#db'

/**
 * @module retrieveMatchedID
 * Retrieve all user bets that match the provided matchid
 * @param {integer} searchID - A match ID that we will search for
 *
 */

export function retrieveMatchedID(searchID) {
    new FileRunning(`retrieveMatchedID`)
    return db.many(`SELECT * FROM activebets WHERE matchid = $1`, [searchID])
}
