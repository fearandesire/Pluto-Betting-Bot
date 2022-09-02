import { Log } from '../bot_res/send_functions/consoleLog.js'
import { QuickError } from '../bot_res/send_functions/embedReply.js'
import { globalLog } from '#Logger'
import { isExistingUser } from './isExistingUser.js'

/**
 * @module validateExistingUser -
 * Validates if a user is registered with the bot (via their userid in 'currency' table)
 * @param {obj} message - Discord.Message
 * @param {integer} userid - The user's ID
 * @returns {boolean} True if the user is registered, throws error otherwise
 * @references
 * - {@link isExistingUser} - DB Query promise function to check if the user is registered in the database
 * - {@link listbets.js} - The invoker of this module is listbets.js
 */
export async function validateUser(message, userid) {
    await isExistingUser(userid).then(function handleResp(data) {
        if (data) {
            globalLog.info(
                `[validateExistingUser.js] User ${userid} is already registered with the bot.`,
            )
            Log.Green(`[validateUser.js] User ${userid} is registered with Pluto.`)
            return
        } else {
            QuickError(message, `You are not registered with Pluto.`)
            globalLog.error(
                `[validateUser.js] User ${userid} is not registered with Pluto.`,
            )
            throw new Error(
                `[validateUser.js] User ${userid} is not registered with Pluto.`,
            )
        }
    })
}
