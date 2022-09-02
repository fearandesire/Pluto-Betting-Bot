import { Command } from '@sapphire/framework'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { processClaim } from '#utilDB/processClaim'

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
        Log.LogBorder()
        Log.LogYellow(`[dailyclaim.js] Running Test Promise!`)
        const userid = message.author.id
        var currentTime = new Date().getTime()
        processClaim(userid, message, currentTime)
    }
}
