import { Log, QuickError } from '#config'

import async from 'async'
import { formatDate } from '../../date/formatDate.js'
import { gameActive } from '#dateUtil/gameActive'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { setupBet } from '#utilBetOps/setupBet'
import { setupBetLog } from '#winstonLogger'
import { validateUser } from '#utilValidate/validateExistingUser'
import { verifyDupBet } from '#utilValidate/verifyDuplicateBet'

export async function newBet(
    message,
    betOnTeam,
    betAmount,
    gameDate,
    interactionEph,
) {
    var user = message?.author?.id || message.user.id
    var userName = message?.author?.tag || message.user.username
    betOnTeam = await resolveTeam(betOnTeam)
    //# Format date to mm/dd/yyyy
    gameDate = await formatDate(gameDate)
    var matchInfo = await resolveMatchup(betOnTeam, null, gameDate)
    if (!matchInfo) {
        QuickError(
            message,
            `Unable to locate a match for ${betOnTeam} on ${gameDate}`,
            true,
        )
        return
    }
    var matchupId = parseInt(matchInfo.matchupId)
    var activeCheck = await gameActive(betOnTeam, matchupId)
    if (!betOnTeam) {
        //# failure to match team
        QuickError(message, 'Please enter a valid team or match id', true)
        return
    }
    if (activeCheck == true) {
        QuickError(
            message,
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
                await validateUser(message, user, true)
                return
            },
            async function verDup() {
                await verifyDupBet(message, user, matchupId)
                return
            },
            async function setBet() {
                await setupBet(
                    message,
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
