//? User should be able to retrieve all their active bets from this command

import { CmdRunning } from '../utils/bot_res/classes/RunCmd.js'
import { Command } from '@sapphire/framework'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { isExistingUser } from '../utils/cmd_res/isExistingUser.js'
import { listMyBets } from '../utils/cmd_res/listMyBets.js'

export class listbets extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'listbets',
			aliases: ['lb', 'mybets'],
			description: "Return User's Active Bets",
			requiredUserPermissions: ['KICK_MEMBERS'],
		})
	}
	async messageRun(message) {
		new CmdRunning(this.name) //? Log command running
		let user = message.author.id //? user id
		//? Ensure that the user exists in the database before we attempt to retrieve their active bets.
		if (user) {
			if (await isExistingUser(user)) {
				await listMyBets(user, message)
				Log.Green(`[${this.name}.js] User ${user} is registered with Pluto`)
				return
			} else {
				await message.reply(`You are not registered with Pluto.`)
				return
			}
		}
		if (await listMyBets(user)) {
			message.reply(`You have an active bet!`)
			return
		} else {
			message.reply(`You have no active bets!`)
			return
		}
	}
}
