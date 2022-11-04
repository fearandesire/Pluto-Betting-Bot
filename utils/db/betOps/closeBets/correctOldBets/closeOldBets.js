import { Log } from '#config'
import { db } from '#db'
import { resolvePayouts } from '#utilBetOps/resolvePayouts'
import { wonDm } from '../../wonDm.js'

/**
 * @module closeOldBets
 * Given the parameters provided, this function will search for matching bets from 'activebets' that match from the provided winning team and 'close' them by the provided odds. Delete and DM the winners and losers of the bet
 * @param {string} winningTeam - The name of the winning team
 * @param {string} losingTeam - The name of the losing team
 * @param {string} odds - The odds of the winning team
 * @param {integer} matchId - The id of the matchup in the DB
 */

export async function closeOldBets(winningTeam, losingTeam, odds, matchid) {
    return new Promise(async (resolve, reject) => {
        var dbStack = await db.tx(async (t) => {
            var getWinners = await t.manyOrNone(
                `SELECT * FROM "betslips" WHERE teamid = $1 AND betresult = 'pending' AND matchid = $2`,
                [winningTeam, matchid],
            )
            if (getWinners) {
                for await (const betslip of getWinners) {
                    //# bet information
                    var betAmount = betslip.amount
                    var betId = betslip.betid
                    var userid = betslip.userid
                    var betOdds = odds
                    var opposingTeam = losingTeam
                    var teamBetOn = winningTeam
                    Log.Yellow(
                        `Bet ID: ${betId} || Bet Odds: ${betOdds} || Bet Amount: ${betAmount}`,
                    )
                    //# calc payout
                    var payAndProfit = await resolvePayouts(betOdds, betAmount)
                    var payout = payAndProfit.payout
                    var profit = payAndProfit.profit
                    const payoutAmount = parseFloat(payout)
                    const profitAmount = parseFloat(profit)
                    //# update betslip with bet result
                    await t.none(
                        `UPDATE "betslips" SET betresult = 'won', payout = $1, profit = $2 WHERE betid = $3`,
                        [payoutAmount, profitAmount, betId],
                    )
                    //# get balance of the user to update it with the winnings
                    const userBal = await t.oneOrNone(
                        `SELECT balance FROM "currency" WHERE userid = $1`,
                        [userid],
                    )
                    //# calc winnings
                    const currentUserBal = parseFloat(userBal?.balance)
                    const newUserBal = currentUserBal + payoutAmount
                    await t.oneOrNone(
                        `UPDATE "currency" SET balance = $1 WHERE userid = $2`,
                        [newUserBal, userid],
                    )
                    await t.none(`DELETE FROM "activebets" WHERE betid = $1`, [betId])
                    var wonBetInformation = await {
                        [`userId`]: userid,
                        [`betId`]: betId,
                        [`wonOrLost`]: `won`,
                        [`payout`]: payout,
                        [`profit`]: profit,
                        [`teamBetOn`]: teamBetOn,
                        [`opposingTeam`]: opposingTeam,
                        [`betAmount`]: betAmount,
                        [`newBalance`]: newUserBal,
                    }
                    await wonDm(wonBetInformation)
                    resolve()
                }
            }
        })
    })
}
