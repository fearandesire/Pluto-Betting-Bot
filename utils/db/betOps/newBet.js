import { Log, QuickError } from '#config'

import async from 'async'
import { gameActive } from '#dateUtil/gameActive'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { sanitizeToSlash } from './../../date/sanitizeToSlash.js'
import { setupBet } from '#utilBetOps/setupBet'
import { setupBetLog } from '#winstonLogger'
import { validateUser } from '#utilValidate/validateExistingUser'
import { verifyDupBet } from '#utilValidate/verifyDuplicateBet'

export async function newBet(
    interaction,
    betOnTeam,
    betAmount,
    gameDate,
    interactionEph,
) {
    var user = interaction?.author?.id || interaction.user.id
    var userName = interaction?.author?.tag || interaction.user.username
    betOnTeam = await resolveTeam(betOnTeam)
    //# Format date to mm/dd/yyyy
    gameDate = await sanitizeToSlash(gameDate)
    if (!gameDate || gameDate == false) {
        QuickError(
            interaction,
            `Please provide a valid date number for the week. Please do not include the month or year.\nExamples of valid inputs: \`8\` or \`8th\`, \`9\` or \`9th\`, \`10\` or \`10t\`h, etc`,
            true,
        )
        return
    }
    var matchInfo = await resolveMatchup(betOnTeam, null, gameDate)
    if (!matchInfo) {
        QuickError(
            interaction,
            `Unable to locate a match for ${betOnTeam} on ${gameDate}`,
            true,
        )
        return
    }
    var matchupId = parseInt(matchInfo.matchupId)
    var activeCheck = await gameActive(betOnTeam, matchupId)
    if (!betOnTeam) {
        //# failure to match team
        QuickError(interaction, 'Please enter a valid team or match id', true)
        return
    }
    if (activeCheck == true) {
        QuickError(
            interaction,
            `This match has already started. You are unable to place a bet on active games.`,
            true,
        )
        return
    }
    await setupBetLog.info(
        `User ${userName} (${user}) is getting a bet ready!\nBet Slip:\nAmount: ${betAmount}\nTeam: ${betOnTeam}`,
    )
    async.series(
        [
            async function valUser() {
                await validateUser(interaction, user, true)
                return
            },
            async function verDup() {
                await verifyDupBet(interaction, user, matchupId)
                return
            },
            async function setBet() {
                await setupBet(
                    interaction,
                    betOnTeam,
                    betAmount,
                    user,
                    matchupId,
                    gameDate,
                    interactionEph,
                )
                return
            },
        ],
        function (err) {
            if (err) {
                Log.Red(err)
                setupBetLog.error(`Error: ${err}`)
                return
            }
        },
    )
}
