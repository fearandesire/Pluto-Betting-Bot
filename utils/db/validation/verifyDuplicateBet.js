import { FileRunning } from '#botClasses/FileRunning'
import { Log } from '#LogColor'
import { QuickError } from '#embed'
import { isDuplicateBet } from '#utilValidate/isDuplicateBet'
import { pendingBet } from './pendingBet.js'

/**
 * @module verifyDuplicateBet - This module is used to verify if a new bet being placed is possibly a duplicate of an existing one.
 * @param {integer} userid - The user's ID
 * @param {string} betOnTeam - The team the user is betting on
 * @param {obj} message - The message object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 @returns {boolean} - False if the bet is not a duplicate, throws error otherwise
*/
//? Check if the user is duplicating their existing bet

export async function verifyDupBet(message, userid, matchId) {
    new FileRunning(`verifyDupBet`)
    await isDuplicateBet(userid, matchId).then(async (data) => {
        if (data) {
            QuickError(message, `You have already placed a bet on this match`)
            //# delete from pending
            await new pendingBet().deletePending(userid)
            throw Log.Error(
                `[verifyDupBet.js] User ${userid} has already placed a bet on Matchup: ${matchId} - ended event`,
            )
        } else {
            return false
        }
    })
}
