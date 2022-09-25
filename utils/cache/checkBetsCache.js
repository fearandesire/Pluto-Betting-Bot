import { Log, QuickError, embedReply, flatcache } from '#config'

import { NoDataFoundError } from '#botClasses/Errors'
import { hasActiveBets } from '#utilValidate/hasActiveBets'
import { listMyBets } from '#utilDB/listMyBets'
import { validateUser } from '#utilValidate/validateExistingUser'

/**
 * Check betslips in local cache for list of user bets. If there is no data for the user stored in cache, then retrieve the bets for the user via the activebets table in the databse.
 * @param {object} message - The Discord message object
 * @param {integer} userId - The Discord ID of the user
 * @return {object} Return an embed object of the current bets for the user.
 */

export async function checkBetsCache(message, userId, interactionEph) {
    var allbetSlipsCache = await flatcache.load(
        'allbetSlipsCache.json',
        './cache/betslips',
    )
    var user = userId
    var isSelf =
        message?.author?.id === userId
            ? true
            : message?.user?.id === userId
            ? true
            : false
    var usersBetSlips =
        (await allbetSlipsCache.getKey(`${user}-activeBetslips`)) || null //? get user's active bet slips embed from local storage
    console.log(`Bet Slip For User: >>`, usersBetSlips)
    //? Ensure that the user exists in the database before we attempt to retrieve their active bets.
    await validateUser(message, user, interactionEph) //? Validate User in DB
    //? Validate if user has any active bets
    await hasActiveBets(user).then((data) => {
        //console.log(data)
        if (data.length > 0) {
            Log.Yellow(`[hasActiveBet.js] User ${user} has active bets`)
            return true
        } else {
            QuickError(message, 'You have no active bets', interactionEph)
            throw new NoDataFoundError(
                `User ${user} has no active bets`,
                'listBets.js',
            )
        }
    })
    //? Check local storage for user's active bets to limit DB queries
    if (
        (await allbetSlipsCache.getKey(`${user}-hasBetsEmbed`)) == true &&
        usersBetSlips !== null
    ) {
        // Log.Green(
        //     `Collected User Betslip Embed Fields: ${JSON.stringify(usersBetSlips)}`,
        // )
        var userName = message?.author?.username || message?.user?.username
        var isSilent = interactionEph ? true : false
        var title
        if (isSelf === true) {
            title = `Your Active Bet Slips [debug]`
        } else if (isSelf === false) {
            title = `${userName}'s Active Bet Slips`
        }
        var embedcontent = {
            title: title,
            color: '#00FF00',
            fields: usersBetSlips,
            silent: isSilent,
        }
        embedReply(message, embedcontent)
        return
    } else {
        await listMyBets(user, message)
        return
    }
}
