//? cmd for quick testing of functions

import { Command } from '@sapphire/framework'
import { gameActive } from '../utils/date/gameActive.js'

//import { sortCancelBet } from '../utils/cmd_res/CancelBet/sortCancelBet.js'
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
	async messageRun(message, args) {
		console.log(`running test..`)
		var active = await gameActive(`Kansas City Chiefs`)
		console.log(active)
	}
}
