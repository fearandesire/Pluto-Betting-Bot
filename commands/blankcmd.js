//? cmd for quick testing of functions

import { Command } from '@sapphire/framework'
import { initCloseBets } from '../utils/closeBets/initCloseBets.js'

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
        message = null
        await initCloseBets(message, 8480, 'Atlanta Falcons')
    }
}
