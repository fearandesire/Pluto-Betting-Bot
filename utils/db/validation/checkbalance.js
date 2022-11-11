import { Log, QuickError, embedReply } from '#config'

import { SapDiscClient } from '#main'
import accounting from 'accounting'
import { db } from '#db'

/**
 * @module checkBalance -
 * ⁡⁣⁣⁢⁡⁣⁣⁢Queries the database for the balance of a user via their userid⁡
 * @param {integer} inputuserid - The user's ID
 * @param {obj} message - The message object from the Discord.js API
 * @param {boolean} target - This will either be true or false, dependant on whether or not a userid was inputted.
 * If true, the 'inputuserid' will be the target user's id.
 * @references {@link balance.js} - balance.js calls this function to retrieve the balance of a user.
 */

export async function checkbalance(inputuserid, message, target) {
    let targetName = target?.user?.username
    let targetId = target?.id
    let queryUserOrTarget
    Log.Yellow(`[checkbalance.js] Checking balance.`)
    if (target) {
        queryUserOrTarget = targetId
    } else {
        queryUserOrTarget = inputuserid
    }
    db.tx('checkbalance-Transaction', async (t) => {
        //? Querying database for the balance. Our query results are stored in the 'findings' variable
        const balQuery = await t.oneOrNone(
            'SELECT * FROM currency WHERE userid = $1',
            [queryUserOrTarget],
        )
        //? Findings will return null (!findings) if the user does not exist in the database
        //? In this instance, since 'notusercheck' is true; which means we are checking for another user's information. This is relevant for our response message
        if (!balQuery && target) {
            QuickError(message, `User ${targetId} is not registered with Pluto.`)
            Log.Error('User has no Betting history')
            return
        }
        if (!balQuery) {
            //? Findings is null, meaning the user does not exist in the database.
            Log.BrightBlue(
                `[checkbalance.js] User ${inputuserid} is not in the database, creating user`,
            )
            message.reply(
                `I see this is your first time using Pluto, welcome! I've created an account for you and assigned 100 dollars.`,
            )
            return t.any(
                'INSERT INTO currency (userid, balance) VALUES ($1, $2) RETURNING *',
                [inputuserid, '100'],
            ) //? Create user in the database
        }
        var balance = accounting.format(balQuery.balance)
        //? The user exists in the database
        if (balQuery.userid === inputuserid && !target) {
            var discordName = await SapDiscClient.users.fetch(inputuserid) //? Fetch the target user
            discordName = discordName || 'User'
            var balEmbed = {
                title: `:money_with_wings: ${discordName.username}'s Funds`,
                description: `**Current Balance: \`${balance}\`**`,
                color: '#00FF00',
                footer: 'For assistance, DM FENIX#7559',
            }
            embedReply(message, balEmbed) //? Sending embed with balance to user
        } else if (balQuery.userid === targetId) {
            var calledBy = await SapDiscClient.users.fetch(inputuserid) //? Fetch user who called the command
            var targetBalEmbd = {
                title: `:money_with_wings: ${targetName}'s Funds`,
                description: `**Current Balance: \`${balance}\`**\n*Requested by ${calledBy.username}*`,
                color: '#00FF00',
                footer: 'For assistance, DM FENIX#7559',
            }
            embedReply(message, targetBalEmbd) //? Sending embed with balance to user
        }
    })
        //? Catching connection errors, not database data/table/error errors.
        .catch((error) => {
            Log.Border(`[checkbalance.js] Something went wrong...`)
            Log.Error(error)
            return
        })
}
