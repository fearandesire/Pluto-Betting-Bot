import { Log } from '#LogColor'
import { container, CURRENCY } from '#config'
import { db } from '#db'
import { setupBetLog } from '#winstonLogger'

/**
 * @module sortBalance - This is used to subtract a users bet amount from their current balance.
 * @summary - When a user places a bet, the amount they want to bet will be subtracted from their current balance.
 * In order to do such, we first query for their balance into the currency/profile table. Afterwords, we ensure that the user has enough funds to bet.
 * If they do, we subtract the bet amount from their balance and update the DB.
 * If they dont, we throw an error and tell them they dot have enough funds.
 * @param {obj} message - The mesage object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @param {integer} userid - The user's discord id
 * @param {integer} betamount - The amount of dollars the user is betting
 * @references
 * - {@link confirmBet.js} - Invoked from confirmBet.js - a function that asks the user to confirm their bet
 */
export function sortBalance(message, userid, betamount, addOrSub) {
    let newBalance
    if (addOrSub == `sub`) {
        //? Using DB transactions to make more than 1 query.
        db.tx(`sortBalance-Transaction`, async (t) => {
            const currentBalance = await t.oneOrNone(
                `SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
                [userid],
                (a) => a.balance,
            )
            //? Failsafe for balance checking
            if (parseInt(currentBalance) < parseInt(betamount)) {
                Log.Error(
                    `[sortBalance.js] User ${userid} does not have enough money to bet ${betamount}\n Current Balance:`,
                )
                Log.BrightBlue(JSON.stringify(currentBalance))
                message.reply({
                    content: `You do not have enough money to bet $${betamount}!`,
                    ephemeral: true,
                })
                return
            }
            setupBetLog.info(
                `User ${userid} has enough money to bet ${betamount} - Current Balance: ${currentBalance}`,
            )
            //Log.Green(`[sortBalance.js] User ${userid} has ${currentBalance} dollars`)
            newBalance = parseInt(currentBalance) - parseInt(betamount)
            container.newBal[`${userid}`] = newBalance
            return t.any(
                `UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2 RETURNING *`,
                [newBalance, userid],
            )
        }).then((data) => {
            if (data) {
                //? Data here returns in array format, so accessing first result (and should be the only result as its 1 identity per user)
                //? Not all pg-promise queries return an array, so be sure to check if data is an array before accessing it via pg-promise docs
                setupBetLog.info(
                    `Successfully subtracted $${betamount} dollars from user ${userid}. New Balance: ${newBalance}`,
                )
                return data[0].balance
            }
        })
    }
    if (addOrSub == `add`) {
        //? Using DB transactions to make more than 1 query.
        db.tx(`sortBalance-Transaction`, async (t) => {
            const currentBalance = await t.oneOrNone(
                `SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
                [userid],
                (a) => a.balance,
            )
            //# failsafe verify balance of user
            if (parseInt(currentBalance) < parseInt(betamount)) {
                Log.Error(
                    `[sortBalance.js] User ${userid} does not have enough money to bet ${betamount}\n Current Balance:`,
                )
                Log.BrightBlue(JSON.stringify(currentBalance))
                message.reply({
                    content: `You do not have enough money to bet $${betamount}!`,
                    ephemeral: true,
                })
                return
            }
            const newBalance = parseInt(currentBalance) - parseInt(betamount)
            return t.any(
                `UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2 RETURNING *`,
                [newBalance, userid],
            )
        }).then((data) => {
            if (data) {
                //? Data here returns in array format, so accessing first result (and should be the only result as its 1 identity per user)
                //? Not all pg-promise queries return an array, so be sure to check if data is an array before accessing it via pg-promise docs
                // Log.Green(
                //     `[sortBalance.js] User ${userid} has ${data[0].balance} dollars`,
                // )
                // Log.BrightBlue(JSON.stringify(data))
                // Log.Green(
                //     `[sortBalance.js] Successfully subtracted ${betamount} dollars from user ${userid}. New Balance: ${data[0].balance}`,
                // )
                setupBetLog.info(
                    `Successfully subtracted ${betamount} dollars from user ${userid}. New Balance: $${data[0].balance}\nBet Setup successfully!`,
                )
                return data[0].balance
            }
        })
    }
}
