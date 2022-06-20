import { Command } from '@sapphire/framework'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { processClaim } from '../utils/cmd_res/processClaim.js'

export class dailyclaim extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'dailyclaim',
			aliases: ['claim', 'dc'],
			description: 'Daily Claim',
			requiredUserPermissions: ['KICK_MEMBERS'],
		})
	}

	async messageRun(message) {
		Log.Border()
		Log.Yellow(`[dailyclaim.js] Running Test Promise!`)
		const userid = message.author.id
		var currentTime = new Date().getTime()
		processClaim(userid, message, currentTime)
	}
}
