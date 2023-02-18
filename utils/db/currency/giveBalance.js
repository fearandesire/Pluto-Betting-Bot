import { Log } from '#LogColor'
import { SapDiscClient } from '#main'
import { db } from '#db'
import { dmLog } from '../../logging.js'
import { embedReply, CURRENCY, formatCurrency } from '#config'
import { giveMoneyLog } from '#winstonLogger'
import { isInServer } from '../../bot_res/isInServer.js'

/**
 * @module giveBalance - Give money / dollars to a specified user
 * @param {integer} interaction - The Discord Message Object
 * @param {integer} targetUserId - The user's Discord ID
 * @param {integer} transferammount - How much to give the user
 */

export async function giveBalance(
    interaction,
    targetUserId,
    transferammount,
    interactionEph,
) {
    Log.Yellow(`[transfer.js] Running transfer!`)

    db.tx('processClaim-Transaction', async (t) => {
        const findUser = await t.oneOrNone(
            `SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
            [targetUserId],
        )
        var currentBalance = findUser.balance
        var updatebalance = parseInt(currentBalance) + parseInt(transferammount)
        var isSilent = interactionEph ? true : false
        var embObj = {
            title: `:moneybag: Added Money`,
            description: `You have sent ${formatCurrency(transferammount)} to <@${targetUserId}>!`,
            color: `#00ff40`,
            silent: isSilent,
            target: `reply`,
        }
        await embedReply(interaction, embObj)
        await giveMoneyLog.info(
            `${interaction.user.username} gave ${targetUserId} $${transferammount}!`,
        )
        //# DM the user they received money
        var verifyUser = await isInServer(targetUserId)
        if (verifyUser) {
            var receivedMoneyEmb = {
                title: `:moneybag: Received Money`,
                description: `You have received $${transferammount} from <@${interaction.user.id}>!`,
                color: `#00ff40`,
            }
            await SapDiscClient.users.fetch(`${targetUserId}`).then(async (user) => {
                if (!user) {
                    dmLog.error(
                        `Failed to send DM to user ${targetUserId} is no longer in the server.`,
                    )
                    return
                }
                await user.send({ embeds: [receivedMoneyEmb] })
                await dmLog.info(`DM'd ${targetUserId} successfully`)
            })
        }
        return t.any(
            `UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2 RETURNING *`,
            [updatebalance, targetUserId],
        )
    })
}
