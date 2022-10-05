import { Command } from '@sapphire/framework'
import { processClaim } from '#utilBetOps/processClaim'

export class dailyclaim extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'dailyclaim',
            aliases: ['claim', 'dc'],
            description: 'Daily Claim',
        })
    }

    async messageRun(message) {
        const userid = message.author.id
        var currentTime = new Date().getTime()
        processClaim(userid, message, currentTime)
    }
}