import { db } from '#db'
import { BETSLIPS } from '#config'
/**
 * @module deleteBet -
 *⁡⁣⁣⁢ deletes a bet from the DB.⁡
 * @param userid - the user's id
 * @param betid - the id of the bet
 * @returns The result of the query.
 * ! To be called with a .then() method to resolve the promise outside of the function
 * CURRENTLY NOT REFERENCED ANYWHERE // NO USES
 */
export function deleteBet(userid, betid) {
    return db.oneOrNone(
        `DELETE FROM "${BETSLIPS}" WHERE userid = $1 AND betid = $2`,
        [userid, betid],
    )
}
