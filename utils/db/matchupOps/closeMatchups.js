import { Log, flatcache } from '#config'

import { SapDiscClient } from '#main'
import { closeMatchupsLog } from '#winstonLogger'
import { db } from '#db'
import { msgBotChan } from '#botUtil/msgBotChan'

//import { removeMatch } from '#utilMatchups/removeMatchup'

/**
 * @module closeMatchups -
 * 'Closes' a specified bet - Intended for 'closing' a bet event, so the bet will only be removed from the 'activebets' table
 * @param {object} betInformation - Object containing all the information about the bet to close out.
 *
 */

export async function closeMatchups(betInformation) {
    //# return as promise
    return new Promise(async (resolve, reject) => {
        Log.Yellow(`[closeMatchups.js] Closing Bet...`)
        /**
         * @var {integer} userid - The Discord ID of the user whose bet we are closing
         * @var {integer} betid - The bet's ID
         * @var {string} wonOrLost - Whether the bet was won or lost
         * @var {integer} profit - The profit amount to be payed out
         * @var {integer} payout - The total amount of money the user will receive
         * @var {integer} betAmount - The amount the user bet
         * @var {string} teamBetOn - The team the user bet on
         * @var {string} oppsingTeam - The team going against the team the user has bet on
         */
        var userid = betInformation?.userId
        var betid = betInformation?.betId
        var wonOrLost = betInformation?.wonOrLost
        var payout = betInformation?.payout
        var profit = betInformation?.profit
        var teamBetOn = betInformation?.teamBetOn
        var opposingTeam = betInformation?.opposingTeam
        var onLastBet = betInformation?.onLastBet
        var matchId = betInformation?.matchId
        closeMatchupsLog.info(`Launching [closeMatchups.js]`)
        closeMatchupsLog.info(`Betslip Information Received:`)
        closeMatchupsLog.info(betInformation)
        let allbetSlipsCache = flatcache.create(
            `allbetSlipsCache.json`,
            './cache/betslips',
        )
        //& Operations for a bet that was won
        if (wonOrLost === 'won') {
            db.tx('closeMatchups', async (t) => {
                const getBetCount = await t.manyOrNone(
                    `SELECT count(*) FROM activebets WHERE userid = $1`,
                    [userid],
                    (c) => c.count,
                )
                const betCount = parseInt(getBetCount[0].count) //? convert count of bets to integer
                closeMatchupsLog.info(
                    `[closeMatchups.js] User ${userid} has ` +
                        betCount +
                        ` active bet(s).`,
                )
                if (betCount === 0) {
                    await closeMatchupsLog.error(
                        `User ${userid} has no active bets\nCeased closing bet operations - no data has been changed,`,
                    )
                    await msgBotChan(
                        `User ${userid} has no active bets - Unable to close their bet. Moving onto the next bet, but please verify this information is true.`,
                        true,
                    )
                    resolve()
                }
                if (betCount > 0) {
                    //# retrieve balance of user
                    const userBal = await t.oneOrNone(
                        `SELECT balance FROM currency WHERE userid = $1`,
                        [userid],
                    )
                    const payoutAmount = parseFloat(payout)
                    const profitAmount = parseFloat(profit)
                    const currentUserBal = parseFloat(userBal.balance)
                    const newUserBal = currentUserBal + profitAmount
                    await closeMatchupsLog.info(
                        `USER ${userid} HAS WON THEIR BET (ID: ${betid}) - PROCESSING PAYOUT\n\nBALANCE INFORMATION FOR USER ${userid}:\nCurrent Balance:$${currentUserBal}\nProfit Amount:$${profitAmount}\nNew Balance:$${newUserBal}`,
                    )
                    await t.oneOrNone(
                        `DELETE FROM activebets WHERE userid = $1 AND betid = $2`,
                        [
                            //? Delete from activebets table
                            userid,
                            betid,
                        ],
                    ),
                        await closeMatchupsLog.info(
                            `[closeMatchups.js] Deleted ${betid} from 'activebets' table.`,
                        )
                    await t.oneOrNone(
                        `UPDATE currency SET balance = $1 WHERE userid = $2`,
                        [newUserBal, userid],
                    )
                    //# update table containing all bets [betslips] for record purposes (bet history)
                    await t.oneOrNone(
                        `UPDATE betslips SET payout = $1, profit = $2, betresult = $3 WHERE userid = $4 AND betid = $5`,
                        [payoutAmount, profitAmount, `${wonOrLost}`, userid, betid],
                    )

                    await allbetSlipsCache.setKey(`${userid}-hasBetsEmbed`, false)
                    await allbetSlipsCache.save(true)
                    var embObj = {
                        title: `Match: ${teamBetOn} vs. ${opposingTeam}`,
                        description: `You won your bet! Here's your payout info :moneybag:\n**Payout:** $${payoutAmount}\n**Profit:** $${profitAmount}\n**Updated Balance**: $${newUserBal}`,
                        footer: `See an issue here? Please contact FENIX#7559 | Bet ID: ${betid}`,
                        color: `#3abc2c`,
                    }
                    await SapDiscClient.users.fetch(`${userid}`).then((user) => {
                        //# DM the user the result of their bet
                        try {
                            user.send({ embeds: [embObj] })
                            closeMatchupsLog.info(`DM'd ${userid} successfully`)
                        } catch (err) {
                            closeMatchupsLog.info(
                                `Failed to send DM to ${user.tag} (${user.id})`,
                            )
                        }
                    })
                }
            }).then(async (data) => {
                closeMatchupsLog.info(
                    `[closeMatchups.js] Operations for ${userid} completed.`,
                )
                if (onLastBet === true) {
                    closeMatchupsLog.info(`PROCESSED THE LAST BET FOR MATCH ${matchId}`)
                }
                resolve()
            })
            //& Operations for a bet that was lost
        } else if (wonOrLost === 'lost') {
            db.tx('closeMatchups', async (t) => {
                const getBetCount = await t.manyOrNone(
                    `SELECT count(*) FROM activebets WHERE userid = $1`,
                    [userid],
                    (c) => c.count,
                )
                const betCount = parseInt(getBetCount[0].count) //? convert count of bets to integer
                closeMatchupsLog.info(
                    `[closeMatchups.js] User ${userid} has ` +
                        betCount +
                        ` active bet(s).`,
                )
                if (betCount === 0) {
                    await closeMatchupsLog.error(
                        `User ${userid} has no active bets\nCeased closing bet operations - no data has been changed,`,
                    )
                    await msgBotChan(
                        `User ${userid} has no active bets - Unable to close their bet. Moving onto the next bet, but please verify this information is true.`,
                        true,
                    )
                    resolve()
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
                        await closeMatchupsLog.info(
                            `[closeMatchups.js] Deleted ${betid} from 'activebets' table.`,
                        )
                    await t.oneOrNone(
                        `UPDATE betslips SET betresult = $1 WHERE userid = $2 AND betid = $3`,
                        [wonOrLost, userid, betid],
                    )
                    await allbetSlipsCache.setKey(`${userid}-hasBetsEmbed`, false)
                    await allbetSlipsCache.save(true)
                    closeMatchupsLog.info(
                        `User <@${userid}>'s Bet ${betid} has been closed (Lost Bet).`,
                    )
                    var embObj = {
                        title: `Match: ${teamBetOn} vs. ${opposingTeam}`,
                        description: `**__Result:__** ${teamBetOn} lost - sorry, better luck next time!`,
                        color: `#ff0000`,
                        footer: `See an issue here? Please contact FENIX#7559 | Bet ID: ${betid}`,
                    }
                    //# DM the user the result of their bet
                    await SapDiscClient.users.fetch(`${userid}`).then((user) => {
                        try {
                            user.send({ embeds: [embObj] })
                            closeMatchupsLog.info(`DM'd ${userid} successfully`)
                        } catch (err) {
                            closeMatchupsLog.info(
                                `Failed to send DM to ${user.tag} (${user.id})`,
                            )
                        }
                    })
                }
            }).then((data) => {
                closeMatchupsLog.info(
                    `[closeMatchups.js] Operations for ${userid} completed.`,
                )
                resolve()
            })
        }
    })
}
