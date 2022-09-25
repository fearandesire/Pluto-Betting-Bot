import { FileRunning } from '#botClasses/FileRunning'
import { Log } from '#LogColor'
import { confirmBet } from '#utilBetOps/confirmBet'
import { embedReply } from '#embed'
import { isMatchExist } from '#utilValidate/isMatchExist'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolvePayouts } from '#utilBetOps/resolvePayouts'

/**
 * @module setupBet - This module is used to setup a bet in the DB.
 * @summary - Checks if the team the user wishes to bet on exists in the database, and if it does, it will send
 * the user's bet information to the next function (@link confirmBet)
 * @param {obj} message - The message object from the discord.js library
 * @param {obj} teamid - The team the user wishes to bet on.
 * @param {integer} betamount - The amount of money the user wishes to bet
 * @param {boolean} interactionEph - Whether the response should be visible to the user or not [slash cmd]
 * @references {@link placeBet.js} - The command that 'invokes' this function and passes in our parameters.
 */

export async function setupBet(
    message,
    teamid,
    betamount,
    user,
    interactionEph,
) {
    new FileRunning(`setupBet`)
    await isMatchExist(teamid).then(async (data) => {
        //? if team user wishes to bet on exists in the matchups, Do:
        if (data) {
            var matchid = data.matchid
            Log.Green(
                `[isMatchExist.js] Match ${matchid} [${data.teamone} vs ${data.teamtwo}] exists in the database`,
            )

            var oddsForTeam = await resolveMatchup(teamid, `odds`)
            console.log(`Odds: ${oddsForTeam}`)
            console.log(`team ID: ${teamid}`)
            var potentialPayout = await resolvePayouts(oddsForTeam, betamount)
            //? 'betslip' - object containing the user's bet information
            var betslip = {}
            betslip.userid = user
            betslip.amount = betamount
            betslip.teamid = teamid
            betslip.payout = potentialPayout.payout
            betslip.profit = potentialPayout.profit
            //debug: Log.Yellow(JSON.stringify(betslip))
            confirmBet(message, betslip, user, interactionEph) //# ask user to confirm their bet
            console.log(`user id: ${user}`)
            return true

            //? Otherwise, throw error
        } else {
            var isSilent = interactionEph ? true : false
            var embedcontent = {
                title: 'Bet Error',
                description: `Team containing ${teamid} is not available to bet on. Please review the active matchups.`,
                color: 'RED',
                silent: isSilent,
            }
            embedReply(message, embedcontent)
            throw Log.Error(
                `[setupBet.js] Team containing ${teamid} does not exist in the database`,
            )
        }
    })
}
