import { AssignBetID } from '#botUtil/AssignIDs'
import { db } from '#db'

/**
 * @module isBetIdExisting
 * Query DB to validate if the specific betid already exists. If so, create a new betid and assign a new one.
 * @param {integer} betId - The betid to validate
 */

export async function isBetIdExisting(betId) {
    betId = Number(betId)
    return await db.tx(async (t) => {
        var activeBetsCheck = await t.manyOrNone(
            `SELECT * FROM activebets WHERE "betid" = $1`,
            [betId],
        )
        var betslipsCheck = await t.manyOrNone(
            `SELECT * FROM betslips WHERE "betid" = $1`,
            [betId],
        )
        if (activeBetsCheck || betslipsCheck) {
            var newBetId = await AssignBetID()
            return newBetId
        } else {
            return betId
        }
    })
}
