import { Command } from '@sapphire/framework'
import { removeAllMatchups } from '#utilMatchups/removeAllMatchups'

export class deleteAllMatchups extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'deleteAllMatchups',
            aliases: ['clearmatchups'],
            description: 'Delete all matchups in the database & cache',
        })
    }
    async messageRun(message) {
        await removeAllMatchups()
    }
}
