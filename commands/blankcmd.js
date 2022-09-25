//? cmd for quick testing of functions

import { Command } from '@sapphire/framework'
import { msgBotChan } from '../utils/bot_res/send_functions/msgBotChan.js'

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
        await msgBotChan(`test`)
    }
}
