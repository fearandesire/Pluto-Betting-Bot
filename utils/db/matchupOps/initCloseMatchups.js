import { Log, container, flatcache } from '#config'

import _ from 'lodash'
import { assignMatchID } from '#botUtil/AssignIDs'
import { clearProgress } from './clearProgress.js'
import { closeMatchups } from '#utilMatchups/closeMatchups'
import { deleteBetFromArray } from '#utilBetOps/deleteBetArr'
import { findMatchup } from '#utilMatchups/findMatchup'
import { getBetsFromId } from '#utilBetOps/getBetsFromId'
import { inProgress } from './inProgress.js'
import { initCloseBetLog } from '../../logging.js'
import merge from 'deepmerge'
import { msgBotChan } from '#botUtil/msgBotChan'
import { removeMatch } from '#utilMatchups/removeMatchup'
import { resolvePayouts } from '#utilBetOps/resolvePayouts'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { returnProgress } from './returnProgress.js'
import stringifyObject from 'stringify-object'

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
    await returnProgress(matchId)
        .then(async (res) => {
            if (res == true) {
                Log.Yellow(`Response: ${res}`)
                await initCloseBetLog.info(
                    `Match ${matchId} is already in progress to be closed - Ceasing close bet operations.`,
                )
                await msgBotChan(
                    `Match ${matchId} is already in progress to be closed - Ceasing close bet operations.`,
                )
                throw new Error(
                    `Match ${matchId} is already in progress to be closed - Ceasing close bet operations.`,
                )
            }
        })
        .catch((err) => {
            throw new Error(err)
        })
    let opposingTeam
    let onLastBet
    teamThatWon = await resolveTeam(teamThatWon)
    await initCloseBetLog.info(
        `Initilization - Closing Matchup Operation Started!\nMatch ID: ${matchId}, Winning Team: ${teamThatWon}`,
    )
    let pendingSlips = flatcache.create(
        'pendingSlipCache.json',
        './cache/pendingSlipCache',
    )
    matchId = parseInt(matchId)
    await initCloseBetLog.info(`Closing Bets for Matchup ID: ${matchId}`)
    let collectionId = await assignMatchID()
    container.betSlipCount = 0
    await pendingSlips.setKey(`Collection-${collectionId}`, {})
    await initCloseBetLog.info(
        `Pending Slip Cache Created for ${matchId}; Collection ID: ${collectionId}`,
    )
    container.tempObj = pendingSlips.getKey(`Collection-${collectionId}`)
    var locateBets = await getBetsFromId(matchId)
        .then(async (data) => {
            //console.log(`Data from getBetsFromId`, data)
            if (_.isEmpty(data)) {
                initCloseBetLog.error(
                    `== ERROR: == \nUnable to locate bets for Match ID: ${matchId} from the Database.\nLikely, there are no bets for this match.\nPlease verify this is accurate in the databse [activebets table]`,
                )
                throw new Error(`No bets found for Match ID: ${matchId}`)
            }
            /* 
            # iterate through array of bets found with the matchId provided
            # Store betslips into cache with a unique 'collectionId'
            */
            await inProgress(matchId)
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
            await initCloseBetLog.info(
                `Unable to locate bets for Match ID: ${matchId}\nLikely, there are no bets for placed on this match\nPlease verify this is accurate in the database [activebets table]`,
            )
            await initCloseBetLog.error(
                `Unable to locate bets for Match ID: ${matchId}\nLikely, there are no bets for placed on this match\nPlease verify this is accurate in the database [activebets table]`,
            )
            return false
        })
    if (locateBets === null) {
        await initCloseBetLog.info(`No bets found for Match ID: ${matchId}`)
        await initCloseBetLog.error(`No bets found for Match ID: ${matchId}`)
        Log.Red(`No bets found for Match ID: ${matchId}`)
        return
    }
    container.memoryCollection = pendingSlips.getKey(`Collection-${collectionId}`)
    await initCloseBetLog.info(
        `\n===Collected Betslips for ${matchId}\n\n${stringifyObject(
            container.memoryCollection,
        )}\n\n====`,
    )
    //& With the betslips collected, we can now iterate through the collection
    //& As we iterate, we will 'close' the bet, payout the winners, and update the relevant info in the database
    let initCloseBet = async () => {
        for await (const [key, value] of Object.entries(
            container.memoryCollection,
        )) {
            //# assign variable to each betslip obj
            var usersBet = value
            //# iterate through each users bet object found
            for await (const [key, value] of Object.entries(usersBet)) {
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
                    //console.log(`Opp: ${opposingTeam}`)
                    //# close all bets for those that lost
                    wonOrLost = 'lost'
                    await initCloseBetLog.info(
                        `User <@${userId}> lost their bet - Skipping retrieval of their matchup odds.`,
                    )

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
                } else {
                    await initCloseBetLog.info(
                        `User <@${userId}> won their bet! Retrieving their matchup odds.`,
                    )
                    //# retrieve the odds of the winning team (teamThatWon)  by retrieving the matchup and comparing it to the team in the user's betslip (teamBetOn) collected prior
                    matchOdds = await findMatchup(value.teamBetOn).then(async (data) => {
                        if (data?.teamone == teamBetOn) {
                            await initCloseBetLog.info(`Odds: ${data?.teamoneodds}`)
                            opposingTeam = data?.teamtwo
                            return data?.teamoneodds
                        } else if (data?.teamtwo == teamBetOn) {
                            await initCloseBetLog.info(`Odds: ${data?.teamtwoodds}`)
                            opposingTeam = data?.teamone
                            return data?.teamtwoodds
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
                    Log.Red(`SENDING MATCHUP TO BE CLOSED`)
                    await closeMatchups(betInformation)
                    await deleteBetFromArray(message, userId, betId, silent)
                }
            }
        }
    }
    initCloseBet().then(async () => {
        await msgBotChan(`All bets for Match ID: ${matchId} have been closed.`)
        var lastBetCache = flatcache.create(
            `lastBetCache.json`,
            `./cache/lastBetProcessing`,
        )
        var lastBetArr = lastBetCache.getKey(`lastBetData`)
        if (lastBetArr == undefined) {
            await lastBetCache.setKey(`lastBetData`, [])
            await lastBetCache.save(true)
        }
        await lastBetArr.push(matchId)
        await lastBetCache.save(true)
        await clearProgress(matchId)
        await removeMatch(matchId)
    })
}
