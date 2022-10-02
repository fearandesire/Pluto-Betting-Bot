/** @module listMyBets*/

import { Memory_Betslips as betslipsMem, embedReply, flatcache } from '#config'

import { FileRunning } from '#botClasses/FileRunning'
import { Log } from '#LogColor'
import { QuickError } from '#embed'
import { db } from '#db'
import stringifyObject from 'stringify-object'

/**
 * @module listMyBets
 * ⁡⁣⁣⁢@summary⁡ - ⁡⁣⁣⁢Queries DB 'betslips' table & lists all active bets the user has via an embed reply.⁡⁡
@description    
 1. Executes out a query to the DB using the db.map method to retrieve all active bets for the user from the 'betslips' table, afterwards:
 * 2. After collecting the user's bet information from the query, this function will use our pre-defined empty `Memory_Betslips` object.
 * 3. Within `Memory_Betslips`, we estbalish a set of dynamic properties and push the user's betslips information as nested objects (obj) into an array (arr).
 * 4. We then use this nested arr of objs to utilize Discord's Embed 'Fields' capabilities returning our data to the user (using {@linkcode embedReply}); see: {@link https://discord.js.org/#/docs/main/stable/typedef/MessageEmbedOptions Discord Docs}.
 * 5. After sending the user's betslips in an embed, we use {@linkcode flatcache} to store the user's betslips in a local storage file.
 * @pkg flatcache: A package to use local storage with persistence. Why?:
 * - By storing our users' betslips in a local storage file, we can access them without having to query the DB every time the user wants to view their active bets.
 * - For details on how we use local storage in this file, there is a section commented below.
 * @property  {method} db.map - A simpler way to iterate over a query result. Handles a function for each row retrieved from the query. See: ***{@link http://vitaly-t.github.io/pg-promise/Database.html#map pg-promise Map}***
 * @param {integer} userid - user ID
 * @param {obj} message - The message object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @param {obj} betslipsMem - An empty object to push the user's betslips into. This object is created within memory && cleared at the end of this function to preserve memory. 
 * Initilization of the object is within the config file to retain it's empty value on startup.
 * @returns {obj} embedReply - A Discord embed reply object containing the user's betslips.
 * @references {@link listBets.js} - listBets.js is the `invoker` that will que this function to retrieve the user's betslips.
 *
 */
export function listMyBets(userid, message) {
    let allbetSlipsCache = flatcache.create(
        `allbetSlipsCache.json`,
        './cache/betslips',
    )
    new FileRunning('listMyBets')
    //? This arrow function used in⁡⁣⁣⁢ 𝙙𝙗⁡⁣⁣⁢.𝙢𝙖𝙥⁡ is to declare what we want to do with ⁡⁢⁣⁣𝙚𝙖𝙘𝙝⁡ row of the query result (see pg-promise db.Map method).
    db.map(`SELECT * FROM betslips WHERE userid = $1`, [userid], (row) => {
        var amount = row.amount
        var teamID = row.teamid
        var betid = row.betid
        var result = row.betresult
        if (row == null || row.length == 0 || row.length < 1 || row == undefined) {
            throw Log.Error(
                `[listMyBets.js] No bets found for user ${userid} [init stage]`,
            )
        }
        if (result.toLowerCase() == 'pending') {
            Log.Red(`Pending bet found for user ${userid}`)
            Log.Green(
                `[listMyBets.js] Bets Collected for ${userid}:\n${stringifyObject(
                    row,
                )}`,
            )
            betslipsMem[`${userid}`] = betslipsMem[`${userid}`] || {}
            betslipsMem[`${userid}`].betslip = betslipsMem[`${userid}`].betslip || [] //? Creating an array for the objects (bets info) to be pushed into
            betslipsMem[`${userid}`].betslip.push(
                //? Bet information is placed into the 'betslip' array in this format.
                //? The way Discord will display the information, each object here will be it's own column.
                //? This is important when it comes to manipulating the array for cancellations/modifying bets.
                {
                    name: 'Bet ID',
                    value: `${betid}`,
                    inline: true,
                },
                {
                    name: 'Amount',
                    value: `$${amount}`,
                    inline: true,
                },
                {
                    name: 'Team',
                    value: `${teamID} \n \u200B`, //? `\𝙪𝟮𝟬𝟬𝘽` is a zero-width space (blank space) to placed @ the end to create space between each bet list
                    inline: true,
                },
            )
        } else {
            Log.Red(`Something went wrong when listing bets for user ${userid}`)
            return
        }
    })
        .then(async function handleResp() {
            Log.Green(
                `[listMyBets.js] Collected User (${userid}) Bet Information [Memory - Stage 2]:`,
            )
            Log.BrightBlue(stringifyObject(betslipsMem[`${userid}`].betslip))
            var userName = message?.author?.username
                ? message?.author?.username
                : message?.user?.id
            var isSelf =
                message?.author?.id === userid
                    ? true
                    : message?.user?.id === userid
                    ? true
                    : false
            var title
            if (isSelf == true) {
                title = `Your Active Bet Slips :tickets: `
            } else {
                title = `${userName}'s Active Bet Slips`
            }
            var embedcontent = {
                title: title,
                color: '#00FF00',
                fields: betslipsMem[`${userid}`].betslip,
                target: `reply`,
            }
            await Log.Yellow(`Sending ${userid} their betslips - Embed`)
            await embedReply(message, embedcontent)
            await allbetSlipsCache.setKey(
                `${userid}-activeBetslips`,
                betslipsMem[`${userid}`].betslip,
            )
            await allbetSlipsCache.setKey(`${userid}-hasBetsEmbed`, true)
            await allbetSlipsCache.save(true)
            //!SECTION
            Log.Green(
                `[listMyBets.js] Storing User (${userid}) collected Array of Bet Information.`,
            )
            return
        })
        .catch((err) => {
            Log.Error(`[listMyBets.js] Error checking for active bet\n${err}`)
            QuickError(message, `You currently have no active bets`, true)
            return false
        })
        .finally(() => {
            //? Clearing the array from memory to preserve our memory usage
            delete betslipsMem[`${userid}`]
        })
}
