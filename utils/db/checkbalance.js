//See DB index.Js And ProcessClaim.js

import { Log } from '#LogColor'
import { db } from '../../Database/dbindex.js'

export async function checkbalance(inputuserid, message, notuser) {
    Log.LogYellow(`[checkbalance.js] Running checkbalance!`)
    Log.LogBorder()
    const notusercheck = notuser || false //checks if another userID is being called upon. Set to BOOl

    db.tx('checkbalance-Transaction', async (t) => {
        const findings = await t.oneOrNone(
            'SELECT * FROM currency WHERE userid = $1',
            [inputuserid],
        ) //
        if (!findings && notusercheck == false) {
            // Checks if user not in DB and not Self user ( whoever is calling the command )
            message.reply('User has no Betting history')
            Log.LogError('User has no Betting history')

            return
        }

        if (!findings) {
            // if user is not in DB but is calling upon their own balance "!balance"
            Log.LogBrightBlue(
                `[checkbalance.js]User ${inputuserid} is not in the database, creating user`,
            )

            message.reply(
                `I see this is your first time using Pluto, welcome! I've created an account for you and assigned 100 credits yessirrr.`,
            )
            return t.any(
                'INSERT INTO currency (userid, balance) VALUES ($1, $2) RETURNING *',
                [inputuserid, '100'],
            )
        }
        if (findings.userid === inputuserid) {
            // User in database return balance
            const usersbalance = findings.balance
            message.reply(`Balance: ${usersbalance}`)
            Log.LogBrightBlue(usersbalance)
        }
    })
        //? Catching connection errors, not database data/table/error errors.
        .catch((error) => {
            Log.LogBorder(`[checkbalance.js] Something went wrong...`)
            Log.LogError(error)
            return
        })
}
