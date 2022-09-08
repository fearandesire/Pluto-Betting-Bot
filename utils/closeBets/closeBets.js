import { Log } from '../bot_res/send_functions/consoleLog.js'
import { closeBetsLog } from '../logging.js'
import { db } from '../../Database/dbindex.js'
import { storage } from '../../lib/PlutoConfig.js'

/**
 * @module closeBets -
 * 'Closes' a specified bet - Intended for 'closing' a bet event, so the bet will only be removed from the 'activebets' table
 * @param {integer} userid - The user's ID
 * @param {integer} betid - The bet's ID
 * @param {string} wonOrLost - Whether the bet was won or lost
 * @param {integer} payout - The payout amount
 * @param {integer} betAmount - The amount the user bet
 *
 */
export async function closeBets(userid, betid, wonOrLost, payout, profit) {
    closeBetsLog.info(`Launching [closeBets.js]`)
    await storage.init()
    if (wonOrLost === 'won') {
        db.tx('closeBets', async (t) => {
            const getBetCount = await t.manyOrNone(
                `SELECT count(*) FROM activebets WHERE userid = $1`,
                [userid],
                (c) => c.count,
            )
            const betCount = parseInt(getBetCount[0].count) //? convert count of bets to integer
            closeBetsLog.info(
                `[closeBets.js] User ${userid} has ` + betCount + ` active bet(s).`,
            )
            if (betCount === 0) {
                await closeBetsLog.error(
                    `User ${userid} has no active bets\nCeased closing bet operations - no data has been changed,`,
                )
                throw Log.Error(`[closeBets.js] User ${userid} has no active bets.`)
            }
            if (betCount > 0) {
                const userBal = await t.oneOrNone(
                    `SELECT balance FROM currency WHERE userid = $1`,
                    [userid],
                )
                const payoutAmount = parseFloat(payout)
                const profitAmount = parseFloat(profit)
                const currentUserBal = parseFloat(userBal.balance)
                const newUserBal = currentUserBal + profitAmount
                await t.oneOrNone(
                    `DELETE FROM activebets WHERE userid = $1 AND betid = $2`,
                    [
                        //? Delete from activebets table
                        userid,
                        betid,
                    ],
                ),
                    await closeBetsLog.info(
                        `[closeBets.js] Deleted ${betid} from 'activebets' table.`,
                    )
                await t.oneOrNone(
                    `UPDATE currency SET balance = $1 WHERE userid = $2`,
                    [newUserBal, userid],
                )
                await t.oneOrNone(
                    `UPDATE betslips SET payout = $1, profit = $2, betresult = $3 WHERE userid = $4 AND betid = $5`,
                    [payoutAmount, profitAmount, `${wonOrLost}`, userid, betid],
                )
                await storage.set(`${userid}-hasBetsEmbed`, false)
                closeBetsLog.info(
                    `User <@${userid}>'s Bet ${betid} has been closed (Won Bet).`,
                )
            }
        }).then((data) => {
            closeBetsLog.info(`[closeBets.js] Operations for ${userid} completed.`)
            return data
        })
    }

    if (wonOrLost === 'lost') {
        db.tx('closeBets', async (t) => {
            const getBetCount = await t.manyOrNone(
                `SELECT count(*) FROM activebets WHERE userid = $1`,
                [userid],
                (c) => c.count,
            )
            const betCount = parseInt(getBetCount[0].count) //? convert count of bets to integer
            closeBetsLog.info(
                `[closeBets.js] User ${userid} has ` + betCount + ` active bet(s).`,
            )
            if (betCount === 0) {
                await closeBetsLog.error(
                    `User ${userid} has no active bets\nCeased closing bet operations - no data has been changed,`,
                )
                throw Log.Error(`[closeBets.js] User ${userid} has no active bets.`)
            }
            if (betCount > 0) {
                await t.oneOrNone(
                    `DELETE FROM activebets WHERE userid = $1 AND betid = $2`,
                    [
                        //? Delete from activebets table
                        userid,
                        betid,
                    ],
                ),
                    await closeBetsLog.info(
                        `[closeBets.js] Deleted ${betid} from 'activebets' table.`,
                    )
                await t.oneOrNone(
                    `UPDATE betslips SET betresult = $1 WHERE userid = $2 AND betid = $3`,
                    [wonOrLost, userid, betid],
                )
                await storage.set(`${userid}-hasBetsEmbed`, false)
                closeBetsLog.info(
                    `User <@${userid}>'s Bet ${betid} has been closed (Lost Bet).`,
                )
            }
        }).then((data) => {
            closeBetsLog.info(`[closeBets.js] Operations for ${userid} completed.`)
            return data
        })
    }
}
