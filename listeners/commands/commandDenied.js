import { Listener } from '@sapphire/framework'
import { Log } from '../../utils/bot_res/send_functions/consoleLog.js'

export class CommandDeniedListener extends Listener {
	run(error, { message, command }) {
		var cmduser = message.author.username
		var cmduserid = message.author.id
		var commandName = command
		message.channel.send('You are not allowed to use this command.')
		Log.CmdPermission(cmduser, cmduserid, commandName)
	}
}
