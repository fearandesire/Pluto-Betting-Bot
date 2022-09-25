import { container, flatcache } from '#config'

import _ from 'lodash'
import { assignMatchID } from '../bot_res/AssignIDs.js'
import { closeMatchups } from './closeMatchups.js'
import { deleteBetFromArray } from '../cmd_res/CancelBet/deleteBetArr.js'
import { findMatchup } from '#utilDB/findMatchup'
import { getBetsFromId } from '#utilDB/getBetsFromId'
import { initCloseBetLog } from '../logging.js'
import merge from 'deepmerge'
import { resolvePayouts } from '../payouts/resolvePayouts.js'
import { resolveTeam } from '#cmdUtil/resolveTeam'

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
    initCloseBetLog.info(
        `Initilization - Closing Matchup Operation Started!\nMatch ID: ${matchId}, Winning Team: ${teamThatWon}`,
    )
    let opposingTeam
    let onLastBet
    teamThatWon = await resolveTeam(teamThatWon)
    let pendingSlips = flatcache.create(
        'pendingSlipCache.json',
        './cache/pendingSlipCache',
    )
    matchId = parseInt(matchId)
    initCloseBetLog.info(`Closing Bets for Matchup ID: ${matchId}`)
    let collectionId = await assignMatchID()
    container.betSlipCount = 0
    await pendingSlips.setKey(`Collection-${collectionId}`, {})
    initCloseBetLog.info(
        `Pending Slip Cache Created for ${matchId}; Collection ID: ${collectionId}`,
    )
    container.tempObj = pendingSlips.getKey(`Collection-${collectionId}`)
    await getBetsFromId(matchId)
        .then(async (data) => {
            if (!data) {
                initCloseBetLog.error(
                    `== ERROR: == \nUnable to locate bets for Match ID: ${matchId} from the Database.\nLikely, there are no bets for this match.\nPlease verify this is accurate in the databse [activebets table]`,
                )
                return
            }
            /* 
            # iterate through array of bets found with the matchId provided
            # Store betslips into cache with a unique 'collectionId'
            */
            for (let i = 0; i < data.length; i++) {
                container.betSlipCount += 1
                const bet = data[i]
                const betUserId = bet.userid
                const teamUserBet = bet.teamid
                const betAmount = bet.amount
                const betId = bet.betid
                const betMatchId = bet.matchid
                var usersSlip = {
                    [betMatchId]: {
                        [i]: {
                            userId: betUserId,
                            teamBetOn: teamUserBet,
                            betAmount: betAmount,
                            betId: betId,
                        },
                    },
                }
                //# merge the betslip into the collection - merging to avoid erasing prior data collected
                var merged = await merge(container.tempObj, usersSlip)
                container.tempObj = merged
                //# update the cache
                await pendingSlips.setKey(
                    `Collection-${collectionId}`,
                    container.tempObj,
                )
                //# inform when the last bet for the matchup has been closed
                if (i === data.length - 1) {
                    initCloseBetLog.info(
                        `All bets for Match ID: ${matchId} have been closed.`,
                    )
                    onLastBet = true
                }
            }
        })
        .catch(async (error) => {
            initCloseBetLog.info(
                `Unable to locate bets for Match ID: ${matchId}\nLikely, there are no bets for placed on this match\nPlease verify this is accurate in the database [activebets table]`,
            )
            return
        })
    container.memoryCollection = pendingSlips.getKey(`Collection-${collectionId}`)
    console.log(container.memoryCollection)
    //& With the betslips collected, we can now iterate through the collection
    //& As we iterate, we will 'close' the bet, payout the winners, and update the relevant info in the database
    await _.forIn(container.memoryCollection, (value, key) => {
        //# assign variable to each betslip obj
        var usersBet = value
        //# iterate through each users bet object found
        _.forIn(usersBet, async (value, key) => {
            let userId = value.userId
            let teamBetOn = value.teamBetOn
            let betAmount = value.betAmount
            let betId = value.betId
            betId = parseInt(betId)
            let silent = true
            /** @var {string} matchOdds - Will be populated with the odds of the winning bet */
            let matchOdds
            /** @var {string} wonOrLost - Will be updated with the result of the bet which is determined by the var `teamThatWon` - Used to update the 'betresult' column in the betslips (leaderboard) table */
            let wonOrLost
            if (teamBetOn !== teamThatWon) {
                opposingTeam = teamThatWon
                console.log(`Opp: ${opposingTeam}`)
                //# close all bets for those that lost
                wonOrLost = 'lost'
                await initCloseBetLog.info(
                    `User <@${userId}> lost their bet - Skipping retrieval of their matchup odds.`,
                )
                await closeMatchups(
                    userId,
                    betId,
                    wonOrLost,
                    null,
                    null,
                    teamBetOn,
                    teamThatWon,
                )
                await deleteBetFromArray(message, userId, betId, silent)
            } else {
                await initCloseBetLog.info(
                    `User <@${userId}> won their bet! Retrieving their matchup odds.`,
                )
                //# retrieve the odds of the winning team (teamThatWon)  by retrieving the matchup and comparing it to the team in the user's betslip (teamBetOn) collected prior
                matchOdds = await findMatchup(value.teamBetOn).then(async (data) => {
                    if (data.teamone == teamBetOn) {
                        await initCloseBetLog.info(`Odds: ${data.teamoneodds}`)
                        opposingTeam = data.teamtwo
                        return data.teamoneodds
                    } else if (data.teamtwo == teamBetOn) {
                        await initCloseBetLog.info(`Odds: ${data.teamtwoodds}`)
                        opposingTeam = data.teamone
                        return data.teamtwoodds
                    }
                })
                var payAndProfit = await resolvePayouts(matchOdds, betAmount)
                var payout = payAndProfit.payout
                var profit = payAndProfit.profit
                await initCloseBetLog.info(
                    `User ID: ${userId}\nTeam Bet On: ${teamBetOn}\nBet Amount: ${betAmount}\nBet ID: ${betId}\nMatch Odds: ${matchOdds}\nPayout: ${payout}\nProfit: ${profit}`,
                )
                wonOrLost = 'won'
                var betInformation = await {
                    [`userId`]: userId,
                    [`betId`]: betId,
                    [`wonOrLost`]: wonOrLost,
                    [`matchOdds`]: matchOdds,
                    [`payout`]: payout,
                    [`profit`]: profit,
                    [`teamBetOn`]: teamBetOn,
                    [`opposingTeam`]: opposingTeam,
                    [`onLastBet`]: onLastBet,
                    [`matchId`]: matchId,
                }
                await closeMatchups(betInformation)
                await deleteBetFromArray(message, userId, betId, silent)
            }
        })
    })
}
