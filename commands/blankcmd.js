//? cmd for quick testing of functions

import { Command } from '@sapphire/framework'
import { verifyDate } from '#api/verifyDate'

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
    async messageRun(message) {
        var verifyIso = await verifyDate(`2022-09-11T17:00:00Z`)
        console.log(verifyIso)
    }
}
