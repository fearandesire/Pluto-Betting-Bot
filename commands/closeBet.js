import { Command } from '@sapphire/framework'

export class closeBet extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'closeBet',
            aliases: [''],
            description: 'Close a specific bet event',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }
    async messageRun(message, args) {
        var input = await args.pick('string').catch(() => null)
    }
}
