//import { updateclaim } from './addClaimTime.js';

import { Log } from '#LogColor'
import { db } from '#db'

const cooldown = 86400000 //* 24 hours in milliseconds
export async function processClaim(
    inputuserid,
    message,
    currentTime,
    interactionEph,
) {
    Log.Yellow(`[processClaim.js] Running processClaim!`)
    let embObj
    db.tx('processClaim-Transaction', async (t) => {
        //? Search for user via their Discord ID in the database
        const findUser = await t.oneOrNone(
            'SELECT * FROM currency WHERE userid = $1',
            [inputuserid],
        ) //
        if (!findUser) {
            return
        }
        //? User exists in the DB, but has never used the claim command.
        //? Therefor we process the claim request (add 100 dollars to user's balance & save current time to lastclaimtime cell)
        else if (findUser.lastclaimtime == null) {
            var updatedBalance = parseInt(findUser.balance) + 100
            embObj = {
                title: 'Daily Claim',
                description: `Welcome to Pluto! You have claimed your daily $100.\nYou can use this command again in 24 hours.\nYour new balance: $${updatedBalance}`,
                color: `#00ff00`,
            }
            message.reply({ embeds: [embObj] })

            return t.any(
                'UPDATE currency SET lastclaimtime = $1, balance = $2 WHERE userid = $3 RETURNING *',
                [currentTime, updatedBalance, inputuserid],
            )
        }

        //? At this point, the user has used the claim command at least once.
        //? Now we need to determine if the user is on cooldown.
        else if (findUser.userid === inputuserid) {
            if (cooldown - (currentTime - findUser.lastclaimtime) > 0) {
                Log.BrightBlue(`[processClaim.js] User ${inputuserid} is on cooldown.`)
                Log.Yellow(
                    `[processClaim.js] Math: ${cooldown} - (${currentTime} - ${
                        findUser.lastclaimtime
                    }) = 
                        ${
                                                    cooldown - (currentTime - findUser.lastclaimtime) > 0
                                                } which is less than 0.`,
                )
                message.reply(
                    'You are on cooldown. Please wait 24 hours before using the claim command again.',
                )
                return
            } else {
                var currentBalance = findUser.balance
                var balance = parseInt(currentBalance) + parseInt(100)
                var isSilent = interactionEph ? true : false
                let embObj
                if (isSilent) {
                    embObj = {
                        title: 'Daily Claim',
                        description: `Welcome back! You have claimed your daily $100.\nYou can use this command again in 24 hours.\nYour new balance is: **$${balance}**.`,
                        color: `#00ff00`,
                    }
                    message.reply({ embeds: [embObj] })
                } else if (!isSilent) {
                    embObj = {
                        title: 'Daily Claim',
                        description: `Welcome back! You have claimed your daily $100.\nYou can use this command again in 24 hours.\nYour new balance is: **$${balance}**.`,
                        color: `#00ff00`,
                    }
                    message.reply({ embeds: [embObj] })
                }
                return t.any(
                    'UPDATE currency SET lastclaimtime = $1, balance = $2 WHERE userid = $3 RETURNING *',
                    [currentTime, balance, inputuserid],
                )
            }
        }
        return
    }).catch((error) => {
        Log.Border(`[processClaim.js] Something went wrong...`)
        Log.Error(error)
        return
    })
}
