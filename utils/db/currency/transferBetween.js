import { db } from '#db'
import { embedReply, CURRENCY } from '#config'
import { validateUser } from '#utilValidate/validateExistingUser'

/**
 * Transfer money between two users
 * @param {object} message - The Discord Message Object
 * @param {integer} userId - The ID of the user
 * @param {integer} targetId - The ID of the target user
 * @param {integer} transferAmount - The amount of money to transfer
 */

export async function transferTo(
    message,
    userid,
    targetUserId,
    transferAmount,
    interactionEph,
) {
    let newUserBal
    let newTargetUserBal
    console.log(
        `Transferring ${transferAmount} from ${userid} to ${targetUserId}`,
    )
    await validateUser(message, targetUserId, interactionEph) //? Validate User in DB
    transferAmount = Number(transferAmount)
    db.tx(`transferTo`, async (t) => {
        const getUserBal = await t.oneOrNone(
            `SELECT balance FROM "${CURRENCY}" WHERE userid = $1`,
            [userid],
        )
        if (
            !getUserBal ||
            parseInt(getUserBal.balance) < parseInt(transferAmount)
        ) {
            return message.reply(`You don't have enough money to transfer.`)
        }
        const getTargetUserBal = await t.oneOrNone(
            `SELECT balance FROM "${CURRENCY}" WHERE userid = $1`,
            [targetUserId],
        )
        console.log(
            `User balance: ${getUserBal.balance}\nTarget user balance: ${getTargetUserBal.balance}`,
        )
        newTargetUserBal =
            parseFloat(transferAmount) + parseFloat(getTargetUserBal.balance)
        newUserBal = parseFloat(getUserBal.balance) - parseFloat(transferAmount)
        console.log(
            `New user balance: ${newUserBal}\nNew target user balance: ${newTargetUserBal}`,
        )
        const updateUserBal = await t.oneOrNone(
            `UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2`,
            [newUserBal, userid],
        )
        const updateTargetUserBal = await t.oneOrNone(
            `UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2`,
            [newTargetUserBal, targetUserId],
        )
    }).then(() => {
        var isSilent = interactionEph ? true : false
        var embObj = {
            title: `:moneybag: Credit Transfer :moneybag:`,
            description: `You have successfully transferred **$${transferAmount}** to <@${targetUserId}>\nYour balance is now: **$${newUserBal}**`,
            color: `GREEN`,
            target: `reply`,
            silent: isSilent,
        }
        embedReply(message, embObj)
    })
}
