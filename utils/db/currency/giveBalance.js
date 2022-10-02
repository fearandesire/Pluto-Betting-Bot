import { QuickError, embedReply } from '#config'

import { Log } from '#LogColor'
import { db } from '#db'
import { giveMoneyLog } from '#winstonLogger'

/**
 * @module giveBalance - Give money / dollars to a specified user
 * @param {integer} message - The Discord Message Object
 * @param {integer} inputuserid - The user's Discord ID
 * @param {integer} transferammount - How much to give the user
 */

export async function giveBalance(
    message,
    inputuserid,
    transferammount,
    interactionEph,
) {
    Log.Yellow(`[transfer.js] Running transfer!`)

    db.tx('processClaim-Transaction', async (t) => {
        const findUser = await t.oneOrNone(
            'SELECT * FROM currency WHERE userid = $1',
            [inputuserid],
        )
        var currentBalance = findUser.balance
        if (Number(currentBalance) < Number(transferammount)) {
            QuickError(message, `You do not have enough money to transfer!`, true)
            return
        }
        var updatebalance = parseInt(currentBalance) + parseInt(transferammount)
        var isSilent = interactionEph ? true : false
        var embObj = {
            title: `:moneybag: Added Money`,
            description: `You have successfully given ${transferammount} to <@${inputuserid}>!`,
            color: `#00ff40`,
            silent: isSilent,
        }
        await embedReply(message, embObj)
        giveMoneyLog.info(
            `${message.user.username} gave ${inputuserid} $${transferammount}!`,
        )
        return t.any(
            'UPDATE currency SET balance = $1 WHERE userid = $2 RETURNING *',
            [updatebalance, inputuserid],
        )
    })
}
