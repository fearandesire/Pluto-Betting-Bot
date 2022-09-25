import { Command } from '@sapphire/framework'
import { fetchBetHistory } from '../utils/db/fetchBetHistory.js'

export class myBetHistory extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'mybetHistory',
            aliases: ['bethistory'],
            description: '',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }
    async messageRun(message) {
        var userid = message.author.id
        await fetchBetHistory(message, userid)
    }
}
