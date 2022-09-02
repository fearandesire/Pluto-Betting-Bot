/** @module listMyBets*/

import { Memory_Betslips, storage } from '../../lib/PlutoConfig.js'
import { QuickError, embedReply } from '../bot_res/send_functions/embedReply.js'

import { FileRunning } from '../bot_res/classes/FileRunning.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

/**
 * ⁡⁣⁣⁢@summary -⁡
 * ⁡⁣⁣⁢Queries DB 'betslips' table & lists all active bets the user has via an embed reply.⁡⁡
    1. Executes out a query to the DB using the db.map method to retrieve all active bets for the user from the 'betslips' table, afterwards:
 * 2. After collecting the user's bet information from the query, this function will use our pre-defined empty `Memory_Betslips` object.
 * 3. Within `Memory_Betslips`, we estbalish a set of dynamic properties and push the user's betslips information as nested objects (obj) into an array (arr).
 * 4. We then use this nested arr of objs to utilize Discord's Embed 'Fields' capabilities returning our data to the user (using {@linkcode embedReply}); see: {@link https://discord.js.org/#/docs/main/stable/typedef/MessageEmbedOptions Discord Docs}.
 * 5. After sending the user's betslips in an embed, we use {@linkcode storage} to store the user's betslips in a local storage file.
 * - Notes: When a bet is cancelled, the Memory_Betslips object for the user is cleared.
 * @function storage: A package to uses local storage with persistence. Why?:
 * - By storing our users' betslips in a local storage file, we can access them without having to query the DB every time the user wants to view their active bets.
 * - For details on how we use local storage in this file, there is a section commented below.
 * @property  {method} db.map - A simpler way to iterate over a query result. Handles a function for each row retrieved from the query. See: ***{@link http://vitaly-t.github.io/pg-promise/Database.html#map pg-promise Map}***
 * @param {integer} userid - user ID
 * @param {obj} message - The message object containing the user & their message - also used to reference a direct reply to the user with message.reply()
 * @param {obj} Memory_Betslips - An empty object to push the user's betslips into. This object is created within memory && cleared at the end of this function to preserve memory. 
 * Initilization of the object is within the config file to retain it's empty value on startup.
 * @returns {obj} embedReply - A Discord embed reply object containing the user's betslips.
 * @references {@link listBets.js} - listBets.js is the `invoker` that will que this function to retrieve the user's betslips.
 *
 */
export function listMyBets(userid, message) {
    new FileRunning('listMyBets')
    //? This arrow function used in⁡⁣⁣⁢ 𝙙𝙗⁡⁣⁣⁢.𝙢𝙖𝙥⁡ is to declare what we want to do with ⁡⁢⁣⁣𝙚𝙖𝙘𝙝⁡ row of the query result (see pg-promise db.Map method).
    return db
        .map(`SELECT * FROM betslips WHERE userid = $1`, [userid], (row) => {
            var amount = row.amount
            var teamID = row.teamid
            var betid = row.betid
            if (
                row == null ||
                row.length == 0 ||
                row.length < 1 ||
                row == undefined
            ) {
                throw Log.Error(`[listMyBets.js] No bets found for user ${userid}`)
            }
            Log.Green(`[listMyBets.js] Bets Collected for ${userid}:`)
            Log.BrightBlue(`[listMyBets.js]` + JSON.stringify(row))
            Memory_Betslips[`${userid}`] = Memory_Betslips[`${userid}`] || {}
            Memory_Betslips[`${userid}`].betslip =
                Memory_Betslips[`${userid}`].betslip || [] //? Creating an array for the objects (bets info) to be pushed into
            Memory_Betslips[`${userid}`].betslip.push(
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
                    value: `${amount}`,
                    inline: true,
                },
                {
                    name: 'Team ID',
                    value: `${teamID} \n \u200B`, //? `\𝙪𝟮𝟬𝟬𝘽` is a zero-width space (blank space) to placed @ the end to create space between each bet list
                    inline: true,
                },
            )
        })
        .then(async function handleResp() {
            Log.Green(`[listMyBets.js] Collected User (${userid}) Bet Information:`)
            Log.BrightBlue(JSON.stringify(Memory_Betslips[`${userid}`].betslip))
            var embedcontent = {
                title: `${message.author.username}'s Bet Slips`,
                description: `Here are the active bets for ${message.author.username}`,
                color: '#00FF00',
                fields: Memory_Betslips[`${userid}`].betslip,
            }
            await embedReply(message, embedcontent) // LINK SendEmbedReply
            await storage.init() //? `storage` pkg required it's options to be loaded before we can use it

            //SECTION LOCALSTORAGE⁡
            /*
            * ? Local Persistence is being used to:
                - 1: Lower DB queries
                - 2: Keep information stored in an efficient format through restarts.
            * ? The 'betslips' array of objects (sourced from parent: Memory_Betslips) that was sent to the user are cloned into a new object to reserve/minimize our DB queries (while also trading memory for local persistance storage of the data)
            * ? We use the `{userid}` as a key to keep individual objects for each user + with 'activeBetslips' at the end (${userid}-activeBetslips).
            * ? Additionally, the `${userid}-hasBetsEmbed is created with the boolean true - this is intended to keep track of whether the user has requested betslips embed or not, for the same reason
             */

            await storage.set(
                `${userid}-activeBetslips`,
                Memory_Betslips[`${userid}`].betslip,
            )
            await storage.set(`${userid}-hasBetsEmbed`, true) //? Setting a flag to indicate that the user has used this command, so we can return them the embed without compiling it again - causing the embed to stack, and unnecessarily the DB
            //!SECTION
            Log.Green(
                `[listMyBets.js] Storing User (${userid}) collected Array of Bet Information.`,
            )
        })
        .catch((err) => {
            Log.Error(`[listMyBets.js] Error checking for active bet\n${err}`)
            QuickError(message, `You currently have no active bets`)
            return false
        })
        .finally(() => {
            //? Clearing the array from memory to preserve our memory usage
            delete Memory_Betslips[`${userid}`]
        })
}
