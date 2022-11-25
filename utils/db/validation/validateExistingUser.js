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
 */
export async function validateUser(
    message,
    userid,
    interactionEph,
    betProcess,
) {
    await isExistingUser(userid).then(async function handleResp(data) {
        if (data) {
            Log.Green(`${userid} validated as an existing user`)
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
            await QuickError(message, errorMsg, interactionEph)
            throw Log.Red(
                `[validateUser.js] User ${userid} is not registered with Pluto.`,
            )
        }
    })
}
