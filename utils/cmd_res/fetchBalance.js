import { FileRunning } from '../bot_res/classes/FileRunning.js'
import { db } from '../../Database/dbindex.js'

/**
 * @module fetchBalance -
 * ⁡⁣⁣Retrieve balance for user from the database⁡
 * @param message - The Discord Message Object
 * @param userid - The user's ID.
 * @returns {integer} User Balance
 */

export function fetchBalance(message, userid) {
    new FileRunning(`fetchBalance`)
    return db.oneOrNone(
        'SELECT * FROM currency WHERE userid = $1',
        [userid],
        (a) => a.balance,
    )
}
