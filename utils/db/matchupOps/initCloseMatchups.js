import _ from 'lodash'
import async from 'async'
import { clearProgress } from './clearProgress.js'
import { closeMatchups } from '#utilMatchups/closeMatchups'
import { container } from '#config'
import { deleteBetFromArray } from '#utilBetOps/deleteBetArr'
import { findMatchup } from '#utilMatchups/findMatchup'
import { getBetsFromId } from '#utilBetOps/getBetsFromId'
import { initCloseBetLog } from '../../logging.js'
import { lostDm } from '../betOps/lostDm.js'
import { msgBotChan } from '#botUtil/msgBotChan'
import { removeMatch } from '#utilMatchups/removeMatchup'
import { removeMatchupCache } from './removeMatchupCache.js'
import { resolvePayouts } from '#utilBetOps/resolvePayouts'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import stringifyObject from 'stringify-object'
import { wonDm } from '../betOps/wonDm.js'

/**
 * @module initCloseMatchups
 * @summary Initializing closing all bets for a specified matchup via the match ID.
 * Using the matchup ID, it checks the database for all bets that are open with the specified match ID
 * I utilize local cache to store this bet information so it can be iterated over easily.
 * As we iterate through the bets, we send each one we find to {@link closeMatchups} to close the bet.
 * @param {object} message - The Discord Message Object
 * @param {integer} matchId - The ID of the matchup
 * @param {string} teamThatWon - The team that won. This is currently input manually and not verified with the API
 */

export async function initCloseMatchups(message, matchId, teamThatWon) {
    return new Promise(async (resolve, reject) => {
        let opposingTeam
        teamThatWon = await resolveTeam(teamThatWon)
        await initCloseBetLog.info(
            `Initilization - Closing Matchup Operation Started!\nMatch ID: ${matchId}, Winning Team: ${teamThatWon}`,
        )
        matchId = Number(matchId)
        container.betSlipCount = 0
        await getBetsFromId(matchId).then(async (data) => {
            if (_.isEmpty(data)) {
                initCloseBetLog.error(
                    `== ERROR: == \nUnable to locate bets for Match ID: ${matchId} from the Database.\nLikely, there are no bets for this match.\nPlease verify this is accurate in the databse [activebets table]`,
                )
                reject(`No bets found for Match ID: ${matchId}`)
            }

            //@remind - Change this to a separate log file
            await initCloseBetLog.info(
                `\n===Collected Betslips for Match #${matchId}\n\n${stringifyObject(
                    data,
                )}\n\n====`,
            )

            /* 
            # iterate through array of bets found with the matchId provided
            # Store betslips into cache with a unique 'collectionId'
            */
            for await (let bet of data) {
                container.betSlipCount += 1
                const userId = bet.userid
                const teamBetOn = bet.teamid
                const betAmount = bet.amount
                const betId = Number(bet.betid)
                const matchId = bet.matchid
                const silent = true

                /** @var {string} wonOrLost - Will be updated with the result of the bet which is determined by the var `teamThatWon` */
                //& Process Bets
                if (teamBetOn !== teamThatWon) {
                    //& «««««««« Lost Bet Operations «««««««««««««««««««««« */
                    await initCloseBetLog.info(
                        `User <@${userId}> lost their bet\nBet ID: ${betId}\nBet Amount: ${betAmount}\nTeam Bet On: ${teamBetOn}\nTeam that won: ${teamThatWon}\nMatch ID: ${matchId}`,
                    )
                    opposingTeam = teamThatWon
                    //# prepare bet info object for closing
                    var lostBetInformation = await {
                        [`userId`]: userId,
                        [`betId`]: betId,
                        [`wonOrLost`]: `lost`,
                        [`payout`]: 0,
                        [`profit`]: 0,
                        [`teamBetOn`]: teamBetOn,
                        [`opposingTeam`]: opposingTeam,
                        [`matchId`]: matchId,
                        [`betAmount`]: betAmount,
                    }
                    //# close the bet
                    await closeMatchups(lostBetInformation)
                    //# remove from bet array
                    await deleteBetFromArray(message, userId, betId, silent)
                    async.series([
                        async function closeWin() {
                            await closeMatchups(lostBetInformation)
                            return
                        },
                        async function deleteBet() {
                            await deleteBetFromArray(message, userId, betId, silent)
                            return
                        },
                        async function dmWinner() {
                            await lostDm(message, lostBetInformation)
                            return
                        },
                    ])
                    //& «««««««« End of Lost Bet Operations «««««««« */
                } else if (teamBetOn == teamThatWon) {
                    //& «««««««« Won Bet Operations «««««««« */

                    /** @var {string} matchOdds - Will be populated with the odds of the winning bet */
                    let matchOdds
                    matchOdds = await findMatchup(teamBetOn).then(
                        async (matchOddsData) => {
                            //# retrieve the odds of the winning team (teamThatWon) by retrieving the matchup and comparing it to the team in the user's betslip (teamBetOn) collected prior
                            if (matchOddsData?.teamone == teamBetOn) {
                                await initCloseBetLog.info(
                                    `[Match #${matchId}] Odds: ${matchOddsData?.teamoneodds}`,
                                )
                                opposingTeam = matchOddsData?.teamtwo
                                return matchOddsData?.teamoneodds
                            } else if (matchOddsData?.teamtwo == teamBetOn) {
                                await initCloseBetLog.info(
                                    `[Match #${matchId}] Odds: ${matchOddsData?.teamtwoodds}`,
                                )
                                opposingTeam = matchOddsData?.teamone
                                return matchOddsData?.teamtwoodds
                            }
                        },
                    )
                    var payAndProfit = await resolvePayouts(matchOdds, betAmount)
                    var payout = payAndProfit.payout
                    var profit = payAndProfit.profit
                    await initCloseBetLog.info(
                        `User <@${userId}> won their bet!\nBet ID: ${betId}\nBet Amount: ${betAmount}\nPayout: ${payout}\nProfit: ${profit}\nTeam Bet On: ${teamBetOn}\nTeam that won: ${teamThatWon}\nMatch ID: ${matchId}`,
                    )
                    var wonBetInformation = await {
                        [`userId`]: userId,
                        [`betId`]: betId,
                        [`wonOrLost`]: `won`,
                        [`matchOdds`]: matchOdds,
                        [`payout`]: payout,
                        [`profit`]: profit,
                        [`teamBetOn`]: teamBetOn,
                        [`opposingTeam`]: opposingTeam,
                        [`matchId`]: matchId,
                        [`betAmount`]: betAmount,
                    }
                    //# Place closeMatchups into bluebird Promise
                    async.series([
                        async function closeWin() {
                            await closeMatchups(wonBetInformation)
                        },
                        async function deleteBet() {
                            await deleteBetFromArray(message, userId, betId, silent)
                        },
                        async function dmWinner() {
                            await wonDm(message, wonBetInformation)
                        },
                    ])
                }
                //& «««««««« End of Won Bet Operations «««««««« */
            } //# end of for loop
            await msgBotChan(`All bets for Match ID: #${matchId} have been closed.`)
            await clearProgress(matchId)
            await removeMatch(matchId)
            await removeMatchupCache(matchId)
            resolve()
        })
    }).catch(async (error) => {
        await initCloseBetLog.error(`${error}`)
        await msgBotChan(`${error}`)
        await removeMatch(matchId)
        await removeMatchupCache(matchId)
    })
}
