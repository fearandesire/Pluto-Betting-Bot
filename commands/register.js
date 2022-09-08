import { registerUser } from '#register'
import { Command } from '@sapphire/framework'

export class register extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'register',
			aliases: ['reg'],
			description: 'Register a new user.',
			requiredUserPermissions: ['KICK_MEMBERS'],
		})
	}
	async messageRun(message) {
		var userid = message.author.id
		var inform = true // let the user know if they are is already registered
		await registerUser(message, userid, inform)
		//console.log(reg)
	}
}
