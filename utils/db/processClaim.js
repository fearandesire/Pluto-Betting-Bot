//import { updateclaim } from './addClaimTime.js';

import { Log } from '../ConsoleLogging.js'
import { db } from '../../Database/dbindex.js'

const cooldown = 86400000 //* 24 hours in milliseconds
export async function processClaim(inputuserid, message, currentTime) {
    Log.LogYellow(`[processClaim.js] Running processClaim!`)

    db.tx('processClaim-Transaction', async (t) => {
        //? Search for user via their Discord ID in the database
        const findUser = await t.oneOrNone(
            'SELECT * FROM currency WHERE userid = $1',
            [inputuserid],
        ) //
        if (!findUser) {
            Log.LogBrightBlue(
                `[processClaim.js] User ${inputuserid} is not in the database, creating user`,
            )
            //? add user to DB & process claim in 1 query to minimize DB load
            message.reply(
                `I see this is your first time using Pluto, welcome! I've created an account for you and completed your daily claim request of 100 credits yessirrr.`,
            )
            return t.any(
                'INSERT INTO currency (userid, balance, lastclaimtime) VALUES ($1, $2, $3) RETURNING *',
                [inputuserid, '100', currentTime],
            )
        }

        //? User exists in the DB, but has never used the claim command.
        //? Therefor we process the claim request (add 100 credits to user's balance & save current time to lastclaimtime cell)
        else if (findUser.lastclaimtime == null) {
            Log.LogBrightBlue(
                `[processClaim.js] User ${inputuserid} is in the database, but has never used the claim command. Processing claim`,
            )
            message.reply(
                `Welcome back! I've completed your daily claim request of 100 credits.`,
            )
            return t.any(
                'UPDATE currency SET lastclaimtime = $1, balance = $2 WHERE userid = $3 RETURNING *',
                [currentTime, '100', inputuserid],
            )
        }

        //? At this point, the user has used the claim command at least once.
        //? Now we need to determine if the user is on cooldown.
        else if (findUser.userid === inputuserid) {
            if (cooldown - (currentTime - findUser.lastclaimtime) > 0) {
                Log.LogBrightBlue(
                    `[processClaim.js] User ${inputuserid} is on cooldown.`,
                )
                Log.LogYellow(
                    `[processClaim.js] Math: ${cooldown} - (${currentTime} - ${
                        findUser.lastclaimtime
                    }) = 
                        ${
                                                    cooldown - (currentTime - findUser.lastclaimtime) > 0
                                                } which  
                        is less than 0.`,
                )
                message.reply(
                    'You are on cooldown. Please wait 24 hours before using the claim command again.',
                )
                return
            } else {
                //? User is not on cooldown, processing claim.
                Log.LogBrightBlue(
                    `[processClaim.js] User ${inputuserid} is not on cooldown.`,
                )
                Log.LogYellow(
                    `[processClaim.js] Math: ${cooldown} - (${currentTime} - ${
                        findUser.lastclaimtime
                    }) = 
                    ${
                                            cooldown - (currentTime - findUser.lastclaimtime) > 0
                                        } which  
                    is less than 0.`,
                )
                Log.LogBrightBlue(
                    `[processClaim.js] User ${inputuserid} is in the database || ${findUser.userid}`,
                )

                var currentBalance = findUser.balance
                var balance = parseInt(currentBalance) + parseInt(100)
                message.reply(`Welcome back! Your new balance is ${balance} credits.`)
                return t.any(
                    'UPDATE currency SET lastclaimtime = $1, balance = $2 WHERE userid = $3 RETURNING *',
                    [currentTime, balance, inputuserid],
                )
            }
        }
        return
    })
        //? Catching connection errors, not database data/table/error errors.
        .catch((error) => {
            Log.LogBorder(`[processClaim.js] Something went wrong...`)
            Log.LogError(error)
            return
        })
}
