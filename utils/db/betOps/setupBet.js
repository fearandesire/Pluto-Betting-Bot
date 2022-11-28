import { NBA_ACTIVEMATCHUPS, queryBuilder as qBuilder } from '#config'
import { QuickError, embedReply } from '#embed'

import { FileRunning } from '#botClasses/FileRunning'
import { Log } from '#LogColor'
import { confirmBet } from '#utilBetOps/confirmBet'
import { debugLogging as debug } from '../../bot_res/debugLogging.js'
import { fetchBalance } from '#utilCurrency/fetchBalance'
import { pendingBet } from '#utilValidate/pendingBet'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolvePayouts } from '#utilBetOps/resolvePayouts'
import { validateData } from './../validation/validateData.js'

/**
 * @module setupBet - This module is used to setup a bet in the DB.
 * @summary - Checks if the team the user wishes to bet on exists in the database, and if it does, it will send
 * the user's bet information to the next function (@link confirmBet)
 * @param {obj} message - The message object from the discord.js library
 * @param {obj} betOnTeamName - The team the user wishes to bet on.
 * @param {integer} betamount - The amount of money the user wishes to bet
 */

export async function setupBet(message, teamName, betamount, user) {
    new FileRunning(`setupBet`)
    var dbQuery = qBuilder(NBA_ACTIVEMATCHUPS, [`teamone`, `teamtwo`], teamName)
    await new validateData(dbQuery).uniqueRowOr().then(async (data) => {
        //? if team user wishes to bet on exists in the matchups DB, Do:
        if (data) {
            //# verify user has funds for the bet
            var checkFunds = await fetchBalance(message, user)
            if (!checkFunds) {
                QuickError(
                    message,
                    `Unable to locate any balance for your account in the database.`,
                    true,
                )
                var userName = message?.author?.tag || message.user.username
                throw new Error(
                    `User ${userName} (${user}) does not have sufficient funds to place their bet. [Unable to locate any balance for your account in the database]`,
                )
            } else if (checkFunds < betamount) {
                await new pendingBet().deletePending(user)
                var embedcontent = {
                    title: 'Insufficient Funds',
                    description: `You do not have sufficient funds to place this bet. Your current balance is $**${checkFunds}**`,
                    color: 'RED',
                    target: `reply`,
                }
                await embedReply(message, embedcontent, true)
                throw Log.Error(
                    `User ${user} does not have sufficient funds to place their desired bet ${betamount} on ${teamName}.\n Retrieved Balance: ${checkFunds}`,
                )
            }

            var oddsForTeam = await resolveMatchup(teamName, `odds`)
            var potentialPayout = await resolvePayouts(oddsForTeam, betamount)
            //? 'betslip' - object containing the user's bet information
            var betslip = {}
            betslip.userid = user
            betslip.amount = betamount
            betslip.teamid = teamName
            betslip.payout = potentialPayout.payout
            betslip.profit = potentialPayout.profit
            await confirmBet(message, betslip, user) //# ask user to confirm their bet
            return true
            //? Otherwise, throw error
        } else {
            var embObj = {
                title: 'Bet Error',
                description: `Team containing ${teamName} is not available to bet on. Please review the active matchups.`,
                color: 'RED',
                silent: true,
            }
            await embedReply(message, embObj)
            throw Log.Error(
                `[setupBet.js] Team containing ${teamName} does not exist in the database`,
            )
        }
    })
}
