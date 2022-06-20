import { Command } from '@sapphire/framework'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { checkbalance } from '../utils/cmd_res/checkbalance.js'

export class balance extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'balance',
			aliases: ['checkbalance', 'cb', 'bal', 'bank', 'credits'],
			description: 'check balance',
			requiredUserPermissions: ['KICK_MEMBERS'],
		})
	}
	async messageRun(message, args) {
		const targetbalance = await args.rest('string').catch(() => null)
		Log.Border()
		Log.Yellow(`[balance.js] Running Test Promise!`)
		const userid = message.author.id
		if (targetbalance != null) {
			// if user is checking their own balance
			const userid = targetbalance // changes target id to the User ID to be initiated.
			checkbalance(userid, message) // reinstalls checkbalance function
			return
		}
		if (targetbalance != userid) {
			// if users checking another users balance
			const notuser = true
			checkbalance(userid, message, notuser)
			return
		}
	}
}
