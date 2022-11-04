import { Log } from '#LogColor'
import { QuickError } from '#embed'
import { isExistingUser } from '#utilValidate/isExistingUser'
import { pendingBet } from './pendingBet.js'

/**
 * @module validateExistingUser -
 * Validates if a user is registered with the bot (via their userid in '"NBAcurrency"' table)
 * @param {obj} message - Discord.Message
 * @param {integer} userid - The user's ID
 * @returns {boolean} True if the user is registered, throws error otherwise
 * @references
 * - {@link isExistingUser} - DB Query promise function to check if the user is registered in the database
 * - {@link listbets.js} - The invoker of this module is listbets.js
 */
export async function validateUser(
    message,
    userid,
    interactionEph,
    betProcess,
) {
    await isExistingUser(userid).then(async function handleResp(data) {
        if (data) {
            Log.Green(`[validateUser.js] User ${userid} is registered with Pluto.`)
            return
        } else {
            var errorMsg
            var currentUser = message?.author?.id || message?.user?.id
            if (currentUser == userid) {
                errorMsg = `You are not registered with Pluto. Please register with the command: \`/register\``
            } else {
                errorMsg = `User <@${userid}> is not registered with Pluto.`
            }
            if (betProcess) {
                //# delete from pending
                await new pendingBet().deletePending(userid)
            }
            QuickError(message, errorMsg, interactionEph)
            throw Log.Red(
                `[validateUser.js] User ${userid} is not registered with Pluto.`,
            )
        }
    })
}
