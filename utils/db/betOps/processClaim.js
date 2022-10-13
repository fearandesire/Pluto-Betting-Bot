//import { updateclaim } from './addClaimTime.js';

import { db } from '#db'
import { Log } from '#LogColor'
import {
    addHours,
    format,
    formatDistanceStrict,
    fromUnixTime,
    getUnixTime,
    isAfter,
    parseISO,
} from 'date-fns'

export async function processClaim(inputuserid, message) {
    var today = new Date()
    //# Convert the current time & last claim time to unix
    var rightNow = await getUnixTime(fromUnixTime(today))
    Log.Yellow(
        `[processClaim.js] Processing daily claim request for ${inputuserid}`,
    )
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
                [rightNow, updatedBalance, inputuserid],
            )
        }

        //? At this point, the user has used the claim command at least once.
        //? Now we need to determine if the user is on cooldown.
        else if (findUser.userid === inputuserid) {
            var lastClaim = await getUnixTime(fromUnixTime(findUser.lastclaimtime))
            //# Format the current time & last claim time
            var formatRightNow = await format(rightNow, 'yyyy-MM-dd HH:mm:ss')
            var formatLastClaim = await format(lastClaim, 'yyyy-MM-dd HH:mm:ss')
            //# Parse the times to ISO to get the difference in hours
            var rightNowISO = await parseISO(formatRightNow)
            var lastClaimISO = await parseISO(formatLastClaim)
            //# add 24 hours to the last claim time
            var cooldown = addHours(lastClaimISO, 24)
            var passedCooldown = await isAfter(rightNowISO, cooldown)
            if (passedCooldown == false) {
                var timeLeft = await formatDistanceStrict(rightNowISO, cooldown)
                Log.BrightBlue(`[processClaim.js] User ${inputuserid} is on cooldown.`)
                message.reply({
                    content: `You are on cooldown! You collect your daily $100 again in **${timeLeft}**`,
                    ephemeral: true,
                })
                return
            } else {
                var currentBalance = findUser.balance
                var balance = parseInt(currentBalance) + parseInt(100)
                let embObj
                embObj = {
                    title: 'Daily Claim',
                    description: `Welcome back! You have claimed your daily $100.\nYou can use this command again in 24 hours.\nYour new balance is: **$${balance}**.`,
                    color: `#00ff00`,
                }
                message.reply({ embeds: [embObj], ephemeral: true })
                return t.any(
                    'UPDATE currency SET lastclaimtime = $1, balance = $2 WHERE userid = $3 RETURNING *',
                    [rightNow, balance, inputuserid],
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
