import { Log, QuickError } from '#config'

import async from 'async'
import { fetchBalance } from '#cmdUtil/fetchBalance'
import { gameActive } from '#dateUtil/gameActive'
import { processTrans } from '#cmdUtil/processTrans'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { resovleMatchup } from '../cache/resolveMatchup.js'
import { setupBet } from '#cmdUtil/setupBet'
import { validateUser } from '#cmdUtil/validateExistingUser'
import { verifyDupBet } from '#cmdUtil/verifyDuplicateBet'

export async function newBet(message, betOnTeam, betAmount, interactionEph) {
    var user = message?.author?.id || message.user.id
    var userName = message?.author?.tag || message.user.username
    betOnTeam = await resolveTeam(betOnTeam)
    var matchInfo = await resovleMatchup(betOnTeam)
    var matchupId = parseInt(matchInfo.matchupId)
    var activeCheck = await gameActive(betOnTeam)

    if (!betOnTeam) {
        //# failure to match team
        QuickError(message, 'Please enter a valid team or match id')
        return
    }
    if (activeCheck == true) {
        QuickError(
            message,
            `This match has already started. You are unable to place a bet on active games.`,
        )
        return
    }
    await Log.Yellow(
        `[newBet.js] User ${userName} (${user}) is getting a bet ready!`, //? Debug purposes, this will likely be removed later. For now, it's intended to confirm the user's input
    )
    await Log.Blue(`Bet Slip:\nAmount: ${betAmount}\nTeam: ${betOnTeam}`)
    async.series(
        [
            async function valUser() {
                await validateUser(message, user)
                return
            },
            async function verDup() {
                await verifyDupBet(message, user, matchupId)
                return
            },
            async function setBet() {
                await setupBet(message, betOnTeam, betAmount, user, interactionEph)
                return
            },
            async function insufFunds() {
                var checkFunds = await fetchBalance(message, user)
                if (!checkFunds) {
                    QuickError(
                        message,
                        `Unable to locate any balance for your account in the database.`,
                    )
                    throw new Error(
                        `User ${userName} (${user}) does not have sufficient funds to place their bet. [Unable to locate any balance for your account in the database]`,
                    )
                }
                return
            },
            async function procTran(insufFunds) {
                await processTrans(message, user, insufFunds, betAmount, betOnTeam)
                return
            },
        ],
        function (err) {
            if (err) {
                Log.Red(err)
                return
            }
        },
    )
}
