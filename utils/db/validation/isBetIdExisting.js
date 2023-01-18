import { AssignBetID } from '#botUtil/AssignIDs'
import { db } from '#db'
import { LIVEBETS, BETSLIPS } from '#config'

/**
 * @module isBetIdExisting
 * Query DB to validate if the specific betid already exists. If so, create a new betid and assign a new one.
 * @param {integer} betId - The betid to validate
 */

export async function isBetIdExisting(betId) {
    return new Promise((resolve, reject) => {
        betId = Number(betId)
        let search = (betId) => {
            console.log(`Searching for betid: ${betId}`)
            db.tx(async (t) => {
                var activeBetsCheck = await t.oneOrNone(
                    `SELECT * FROM ${LIVEBETS} WHERE "betid" = $1`,
                    [betId],
                )
                var betslipsCheck = await t.oneOrNone(
                    `SELECT * FROM ${BETSLIPS} WHERE "betid" = $1`,
                    [betId],
                )
                //# recursively call the function if the betid already exists
                if (activeBetsCheck || betslipsCheck) {
                    console.log(`BetID ${betId} already exists!`)
                    betId = await AssignBetID()
                    return search(betId)
                } else {
                    console.log(`BetID ${betId} is available!`)
                    resolve(betId)
                }
            })
        }
        search(betId)
    })
}
