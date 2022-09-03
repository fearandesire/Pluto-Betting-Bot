import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'
/**
 * @module processClaim - First, we check if the user is in the database, if not, it creates a new user identity for them. Otherwise:
 * If the user already exists database, we validate if user has used the claim command before, if not, it processes the claim & finally:
 * If the user has used the claim command before, it checks if the user is on cooldown, if not, we processes the claim.
 * @param {integer} inputuserid - The user's Discord ID
 * @param {integer} message - The mesage object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @param {integer} currentTime - Current time to be stored in the database
 */
//import { updateclaim } from './addClaimTime.js';

export async function transferbalance(message, inputuserid, transferammount) {
    Log.Yellow(`[transfer.js] Running transfer!`)

    db.tx('processClaim-Transaction', async (t) => {
        const findUser = await t.oneOrNone(
            'SELECT * FROM currency WHERE userid = $1',
            [inputuserid],
        )
        var currentBalance = findUser.balance
        var updatebalance = parseInt(currentBalance) + parseInt(transferammount)
        message.reply(`<@${inputuserid}> has been sent ${transferammount} credits.`)
        return t.any(
            'UPDATE currency SET balance = $1 WHERE userid = $2 RETURNING *',
            [updatebalance, inputuserid],
        )
    })
}
