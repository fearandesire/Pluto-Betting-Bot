import { Log, LIVEMATCHUPS, BETSLIPS, LIVEBETS, CURRENCY } from '#config'

import _ from 'lodash'
import { closeBetLog } from '../../../logging.js'
import { db } from '#db'
import { memUse } from '#mem'
import { resolvePayouts } from '#utilBetOps/resolvePayouts'
import { wonDm } from '../wonDm.js'

/**
 * @module closeWonBets
 * 1. Query DB and find all bets that chose the winning team [teamid] in thedb
 * 2. Calculate payout for the bets, and update the db  with the payout
 * 3. Update the user balance in the dbwith the payout
 * 4. DM the user they won their bet
 * @param {string} winningTeam - The team that won the game
 * @param {string} homeOrAway - If this team that won was 'home' or 'away' - string literal
 * @param {string} losingTeam - The losing team
 */

export async function closeWonBets(winningTeam, homeOrAway, losingTeam) {
    return new Promise(async (resolve, reject) => {
        await db.tx(async (t) => {
            // Start a db transaction
            let getMatchInfo = await t.oneOrNone(
                `SELECT * FROM "${LIVEMATCHUPS}" WHERE teamone = $1 AND teamtwo = $2 OR teamone = $2 AND teamtwo = $1`,
                [winningTeam, losingTeam],
            ) // Query DB for matchup info
            if (!getMatchInfo || _.isEmpty(getMatchInfo)) {
                await closeBetLog.error(`No match found for ${winningTeam}`)
                return reject(`No match found for ${winningTeam}`)
            }
            let getWinners = await t.manyOrNone(
                `SELECT * FROM "${BETSLIPS}" WHERE teamid = $1 AND betresult = 'pending'`,
                [winningTeam],
            )
            if (getWinners) {
                for await (const betslip of getWinners) {
                    //# bet information
                    let betAmount = betslip.amount
                    let betId = betslip.betid
                    let userid = betslip.userid
                    let betOdds
                    let opposingTeam
                    let teamBetOn
                    if (homeOrAway === 'home') {
                        betOdds = getMatchInfo.teamoneodds
                        opposingTeam = getMatchInfo.teamtwo
                        teamBetOn = getMatchInfo.teamone
                    } else if (homeOrAway === 'away') {
                        betOdds = getMatchInfo.teamtwoodds
                        opposingTeam = getMatchInfo.teamone
                        teamBetOn = getMatchInfo.teamtwo
                    }
                    Log.Yellow(
                        `Bet ID: ${betId} || Bet Odds: ${betOdds} || Bet Amount: ${betAmount}`,
                    )
                    //# calc payout
                    let payAndProfit = await resolvePayouts(betOdds, betAmount)
                    let payout = payAndProfit.payout
                    let profit = payAndProfit.profit
                    let payoutAmount = parseFloat(payout)
                    let profitAmount = parseFloat(profit)
                    await closeBetLog.info(
                        `Closing Bet Information:\nUser ID: ${userid}\nBet ID: ${betId}\nBet Result: Won\nBet Amount: ${betAmount}\nBet Odds: ${betOdds}\nTeam Bet On: ${teamBetOn}\nOpposing Team: ${opposingTeam}\nWinning Team: ${winningTeam}\nHome or Away: ${homeOrAway}\nPayout: ${payoutAmount}\nProfit: ${profitAmount}`,
                    )
                    //# update betslip with bet result
                    await t.none(
                        `UPDATE "${BETSLIPS}" SET betresult = 'won', payout = $1, profit = $2 WHERE betid = $3`,
                        [payoutAmount, profitAmount, betId],
                    )
                    //# get balance of the user to update it with the winnings
                    const userBal = await t.oneOrNone(
                        `SELECT balance FROM "${CURRENCY}" WHERE userid = $1`,
                        [userid],
                    )
                    //# calc winnings
                    const newUserBal = parseFloat(userBal?.balance) + payoutAmount
                    await t.oneOrNone(
                        `UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2`,
                        [newUserBal, userid],
                    )
                    //# Delete bet from activebets
                    await t.none(`DELETE FROM "${LIVEBETS}" WHERE betid = $1`, [betId])
                    let wonBetInformation = {
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
                    await Log.Green(`Successfully closed bet ${betId} || ${userid}`)
                    await closeBetLog.info(
                        `Successfully closed bet ${betId} || User ID: ${userid}`,
                    )

                    await memUse(`closeWonBets`, `Post-Close Won`)
                }
                resolve()
            }
        })
    })
}
