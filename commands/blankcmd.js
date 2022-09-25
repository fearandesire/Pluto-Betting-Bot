//? cmd for quick testing of functions

import { Command } from '@sapphire/framework'

//import { sortCancelBet } from '#utilBetOps/sortCancelBet.js'
export class testCMD extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'testcmd',
			aliases: ['test'],
			description: 'testing functions',
			requiredUserPermissions: ['KICK_MEMBERS'],
		})
	}
	async messageRun(message, args) {}
}
