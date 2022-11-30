import { Log, QuickError } from '#config'

import async from 'async'
import { gameActive } from '#dateUtil/gameActive'
import { pendingBet } from '#utilValidate/pendingBet'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { setupBet } from '#utilBetOps/setupBet'
import { setupBetLog } from '#winstonLogger'
import { validateUser } from '#utilValidate/validateExistingUser'
import { verifyDupBet } from '#utilValidate/verifyDuplicateBet'

/**
 * @module newBet - This module is used to setup a bet in the DB.
 * Runs checks to validate the user, their bet, and then operations to get the bet setup.
 * @param {obj} interaction - Discord Message object
 * @param {string} betOnTeam - The team the user is betting on
 * @param {integer} betAmount - The amount of money the user is betting
 *
 */
export async function newBet(interaction, betOnTeam, betAmount) {
    let interactionObj = interaction
    var user = interaction?.author?.id || interaction.user.id
    betOnTeam = await resolveTeam(betOnTeam)
    var matchInfo = await resolveMatchup(betOnTeam, null)
    if (!matchInfo) {
        QuickError(interaction, `Unable to locate a match for ${betOnTeam}`, true)
        //# delete from pending
        await new pendingBet().deletePending(user)
        return
    }
    var matchupId = parseInt(matchInfo.matchid)
    var activeCheck = await gameActive(betOnTeam, matchupId)
    if (!betOnTeam) {
        //# failure to locate match
        await QuickError(interaction, 'Please enter a valid team', true)
        //# delete from pending
        await new pendingBet().deletePending(user)
        return
    }
    if (activeCheck == true) {
        await QuickError(
            interaction,
            `This match has already started. You are unable to place a bet on active games.`,
            true,
        )
        //# delete from pending
        await new pendingBet().deletePending(user)
        return
    }
    await setupBetLog.info(`New Betslip Created`, {
        user: user,
        team: betOnTeam,
        amount: betAmount,
        matchupId: matchupId,
    })
    //# using an async series to catch the errors and stop the process if any of the functions fail
    async.series(
        [
            // ensure user is validated
            async function valUser() {
                await validateUser(interaction, user, true, true)
                return
            },
            // verify if the user already has a bet on this matchup
            async function verDup() {
                await verifyDupBet(interaction, user, matchupId, true)
                return
            },
            // setup the bet
            async function setBet() {
                await setupBet(interactionObj, betOnTeam, betAmount, user, matchupId)
                return
            },
        ],
        function (err) {
            if (err) {
                Log.Red(err)
                setupBetLog.error({ errorMsg: err })
                return
            }
        },
    )
}
