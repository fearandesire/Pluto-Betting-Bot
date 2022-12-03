import { db } from '#db'
import { CURRENCY } from '#config'

/**
 * @module isExistingUser -
 * Query promise to the DB resolves to a single row from the database if the user exists,
 * or null if the user does not exist.
 * @param {integer} userid - The user's ID
 * @returns {obj} [1] Row from the query, or null if the user does not exist.
 * @references
 * - {@link listBets.js}
 * - {@link validateExistingUser.js}
 */

//? identify if the user exists in the database

export function isExistingUser(userid) {
    return db.oneOrNone(`SELECT * FROM "${CURRENCY}" WHERE userid = $1`, [userid])
}
