import { Command } from '@sapphire/framework'
import { returnAllMatchups } from '../utils/cache/returnAllMatchups.js'

export class viewAllMatchups extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'viewAllMatchups',
            aliases: ['viewmatches', 'allmatchups'],
            description: '',
            requiredUserPermissions: ['MANAGE_MESSAGES'],
        })
    }
    async messageRun(message, args) {
        var input = await args.rest(`string`).catch(() => null)
        if (!input) {
            input === null
        }
        await returnAllMatchups(message, input)
    }
}
