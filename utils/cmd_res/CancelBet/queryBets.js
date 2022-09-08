import { Log } from '../../bot_res/send_functions/consoleLog.js'
import { QuickError } from '#config'
import { db } from '../../../Database/dbindex.js'
import { storage } from '../../../lib/PlutoConfig.js'

/**
 * @module QueryBets -
 * Query the database to locate & delete the specified bet from the user.
 * @description - This is intended for when a user wants to cancel a bet, so it will remove the bet from the leaderboard table ('betslips') and the activebets table.
 * When initiated, QueryBets will verify if the user has any bets* (failsafe, but can definitely be removed as we verified prior)
 * Following that, we will update the users balance wih how much they bet, since they are cancelling it.
 * The only reason for separation of the user's bets (```betCount```) being either 1 or higher than 1 is to update the `hasBetsEmbed` information;
 * As if the user has no bets remaining, we will need to make sure they are informed of such if they try to list them again, and `hasBetsEmbed` is apart of that check.
 * @param {integer} userid
 * @param {integer} betid
 * @references {@link cancelBet.js}
 */
export async function QueryBets(message, userid, betid) {
    await storage.init()
    db.tx('queryCancelBet', async (t) => {
        const getBetCount = await t.manyOrNone(
            `SELECT count(*) FROM betslips WHERE userid = $1`,
            [userid],
            (c) => c.count,
        )
        const betCount = parseInt(getBetCount[0].count) //? convert count of bets to integer
        Log.Yellow(
            `[queryBets.js] User ${userid} has ` + betCount + ` active bet(s).`,
        )
        if (betCount === 0) {
            await QuickError(
                message,
                `User ${userid} has no active bets\nCeased canceling bet operations - no data has been changed,`,
            )
            throw Log.Error(`[queryBets.js] User ${userid} has no active bets.`)
        }
        if (betCount > 0) {
            //? Update user balance by adding the amount they have bet.
            //? Since we require multiple transactions, we assign the necesary info transactions variables so we can call upon them.
            //* We utilize async functions to grab both the bet amount and the user's balance, and finally updating the balance with the math complete.
            const betData = await t.oneOrNone(
                'SELECT amount FROM betslips WHERE userid = $1 AND betid = $2',
                [userid, betid],
            )
            const userBal = await t.oneOrNone(
                `SELECT balance FROM currency WHERE userid = $1`,
                [userid],
            )
            const placedBetAmount = parseInt(betData.amount)
            const currentUserBal = parseInt(userBal.balance)
            const newBal = currentUserBal + placedBetAmount
            await t.batch([
                await t.oneOrNone(
                    `UPDATE currency SET balance = $1 WHERE userid = $2`,
                    [newBal, userid],
                ),
                await t.oneOrNone(
                    `DELETE FROM activebets WHERE userid = $1 AND betid = $2`,
                    [
                        //? Delete from activebets table
                        userid,
                        betid,
                    ],
                ),
                await t.oneOrNone(
                    `DELETE FROM betslips WHERE userid = $1 AND betid = $2`,
                    [userid, betid],
                ),
            ])
            await storage.set(`${userid}-hasBetsEmbed`, false)
            Log.Green(
                `[queryBets.js] User ${userid} has cancelled bet ${betid}\nSuccessfully updated their balance, and removed the bet from the activebets & betslips table`,
            )
        }
    }).then((data) => {
        Log.Green(`[queryBets.js] Operations for ${userid} completed.`)
        return data
    })
}
