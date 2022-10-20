import { Log, QuickError, embedReply } from '#config'

import { SapDiscClient } from '#main'
import { db } from '#db'

/**
 * @module checkBalance -
 * ⁡⁣⁣⁢⁡⁣⁣⁢Queries the database for the balance of a user via their userid⁡
 * @param {integer} inputuserid - The user's ID
 * @param {obj} message - The message object from the Discord.js API
 * @param {boolean} notuser - This will either be true or false, dependant on whether or not a userid was inputted.
 * If true, the 'inputuserid' will be the target user's id.
 * @references {@link balance.js} - balance.js calls this function to retrieve the balance of a user.
 */

export async function checkbalance(inputuserid, message, notuser) {
    Log.Yellow(`[checkbalance.js] Running checkbalance!`)
    Log.Border()
    const notusercheck = notuser || false //? inherited from: balance.js: if another user is being called on, this is true. Otherwise, it is false.
    db.tx('checkbalance-Transaction', async (t) => {
        //? Querying database for the balance. Our query results are stored in the 'findings' variable
        const findings = await t.oneOrNone(
            'SELECT * FROM currency WHERE userid = $1',
            [inputuserid],
        )
        //? Findings will return null (!findings) if the user does not exist in the database
        //? In this instance, since 'notusercheck' is true; which means we are checking for another user's information. This is relevant for our response message
        if (!findings && notusercheck == true) {
            QuickError(message, `User ${inputuserid} is not registered with Pluto.`)
            Log.Error('User has no Betting history')
            return
        }
        if (!findings) {
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
        //? The user exists in the database
        if (findings.userid === inputuserid) {
            const usersbalance = findings.balance
            var userName = await SapDiscClient.users.fetch(inputuserid) //? Fetching the username of the user via Discord.js API cache
            userName = userName || 'User'
            var embedcontent = {
                title: `${userName.username}'s Balance`,
                description: `You currently have: **$${usersbalance} dollars**.\n To claim your daily 100 dollars, *type /claim*`,
                color: '#00FF00',
                footer: 'For assistance, DM <@208016830491525120>',
            }
            embedReply(message, embedcontent) //? Sending embed with balance to user
            Log.BrightBlue(usersbalance)
        }
    })
        //? Catching connection errors, not database data/table/error errors.
        .catch((error) => {
            Log.Border(`[checkbalance.js] Something went wrong...`)
            Log.Error(error)
            return
        })
}
