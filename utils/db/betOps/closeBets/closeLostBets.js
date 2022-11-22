import { Log, NBA_ACTIVEMATCHUPS } from '#config'

import { closeBetLog } from '../../../logging.js'
import { db } from '#db'
import { lostDm } from '../lostDm.js'
import { memUse } from '#mem'

/**
 * @module closeLostBets
 * 1. Query DB and find all bets that chose the winning team [teamid] in the "NBAbetslips" table
 * 2. Calculate payout for the bets, and update the "NBAbetslips" table with the payout, as well as the betresult with "won"
 * 3. Update the user balance from the "currency" table with the payout
 * 4. DM the user they won their bet
 */

export async function closeLostBets(losingTeam, homeOrAway) {
    return new Promise(async (resolve, reject) => {
        var dbStack = await db.tx(async (t) => {
            // Start a db transaction
            var getMatchInfo = await t.oneOrNone(
                `SELECT * FROM "${NBA_ACTIVEMATCHUPS}" WHERE teamone = $1 OR teamtwo = $1`,
                [losingTeam],
            ) // Query DB for matchup info
            if (!getMatchInfo) {
                await closeBetLog.error(`No match found for ${losingTeam}`)
                return reject(`No match found for ${losingTeam}`)
            }
            var getLosers = await t.manyOrNone(
                `SELECT * FROM "NBAbetslips" WHERE teamid = $1 AND betresult = 'pending'`,
                [losingTeam],
            )
            if (getLosers) {
                for await (const betslip of getLosers) {
                    //# bet information
                    var betAmount = betslip.amount
                    var betId = betslip.betid
                    var userid = betslip.userid
                    var betOdds
                    var opposingTeam
                    var teamBetOn
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
                    await closeBetLog.info(
                        `Closing Bet Information:\nUser ID: ${userid}\nBet Result: Lost\nBet ID: ${betId}\nBet Amount: ${betAmount}\nBet Odds: ${betOdds}\n`,
                    )
                    //# update betslips table to reflect the user lost their bet
                    await t.none(
                        `UPDATE "NBAbetslips" SET betresult = 'lost' WHERE betid = $1`,
                        [betId],
                    )
                    //# Delete bet from activebets
                    await t.none(`DELETE FROM "NBAactivebets" WHERE betid = $1`, [betId])
                    var lostBetInformation = await {
                        [`userId`]: userid,
                        [`betId`]: betId,
                        [`wonOrLost`]: `lost`,
                        [`teamBetOn`]: teamBetOn,
                        [`opposingTeam`]: opposingTeam,
                        [`betAmount`]: betAmount,
                    }
                    await lostDm(lostBetInformation)
                    await closeBetLog.info(
                        `Successfully closed bet ${betId} || ${userid}`,
                    )
                    await memUse(`closeLostBets`, `Post-Close Lost`)
                }
                resolve()
            }
        })
    })
}
