//? User should be able to retrieve all their active bets from this command

import {
	embedReply,
	QuickError,
} from '../utils/bot_res/send_functions/embedReply.js'

import { Command } from '@sapphire/framework'
import { storage } from '../lib/PlutoConfig.js'
import { NoDataFoundError } from '../utils/bot_res/classes/Errors.js'
import { FileRunning } from '../utils/bot_res/classes/FileRunning.js'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { hasActiveBets } from '../utils/cmd_res/hasActiveBets.js'
import { listMyBets } from '../utils/cmd_res/listMyBets.js'
import { validateUser } from '../utils/cmd_res/validateExistingUser.js'

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
		await storage.init()
		new FileRunning(this.name) //? Log command running
		let user = message.author.id //? user id
		var usersBetSlips = (await storage.get(`${user}-activeBetslips`)) || null //? get user's active bet slips embed from local storage
		//? Ensure that the user exists in the database before we attempt to retrieve their active bets.
		// if (user) {
		//  if (await isExistingUser(user)) {
		await validateUser(message, user) //? Validate User in DB
		//? Validate if user has *any* active bets
		await hasActiveBets(user).then((data) => {
			console.log(data)
			if (data.length > 0) {
				Log.Yellow(`[hasActiveBet.js] User ${user} has active bets`)
				return true
			} else {
				QuickError(message, 'You have no active bets')
				throw new NoDataFoundError(
					`User ${user} has no active bets`,
					'listBets.js',
				)
			}
		})
		//? Check local storage for user's active bets to limit DB queries
		if (
			(await storage.get(`${user}-hasBetsEmbed`)) == true &&
			usersBetSlips != null
		) {
			Log.Green(
				`[${
					this.name
				}.js] Collected User Betslip Embed Fields: ${JSON.stringify(
					usersBetSlips,
				)}`,
			)
			var embedcontent = {
				title: `${message.author.username}'s Bet Slips`,
				description: `Here are the active bets for ${message.author.username}`,
				color: '#00FF00',
				fields: usersBetSlips,
			}
			embedReply(message, embedcontent)
			return
		} else {
			await listMyBets(user, message)
			return
		}
	}
}
