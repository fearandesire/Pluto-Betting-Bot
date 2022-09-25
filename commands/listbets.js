//? User should be able to retrieve all their active bets from this command

import { Command } from '@sapphire/framework'
import { FileRunning } from '../utils/bot_res/classes/FileRunning.js'
import { checkBetsCache } from '../utils/cache/checkBetsCache.js'

/**
 * @command listBets -
 * Compiles a list of all active bets for the user. We verify if the request is valid through a couple modules, and then return the information to the user in an Embed.
 * @description - To limit DB queries, after a user uses this command, we compile their information locally to send for repeated inquiries in the future.
 * @param {object} message - The Discord message object. Used to reply to the user.
 * @var user - The Discord user Id of who called the command.
 * @var usersBetSlips - Retrieve's the user's betslips from local storage. If we have no data, we will query the database
 * @function validateUser - Ensures the user exists in the database
 * @function hasActiveBets - Queries the database to validate any active bets from the user.
 * @function listMyBets - Queries DB & compiles a list of all active bets for the user via Discord Embed.
 * @package storage - Persistant Local Storage; Provided by {@link https://www.npmjs.com/package/node-persist node-persist}
 * @returns {object} - An embed of the user's active bets if they have any -- otherwise, an error message.
 */
export class listbets extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'listbets',
            aliases: ['lb', 'mybets'],
            description: "Return User's Active Bets",
        })
    }
    async messageRun(message) {
        new FileRunning(this.name) //? Log command running
        let user = message.author.id //? user id
        await checkBetsCache(message, user)
    }
}
