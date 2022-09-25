import { Command } from '@sapphire/framework'
import { SapDiscClient } from '#main'

export class deleteSlashCmd extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'deleteSlashCmd',
            aliases: [''],
            description: '',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }
    async messageRun(message, args) {
        //console.log(await SapDiscClient.application.commands.cache) //# view all slash commands registered
        var input = await args.pick('string').catch(() => null)
        var app = await SapDiscClient.application.commands.delete(`${input}`)
        console.log(app)
        message.reply(`Successfully deleted slash command with ID: ${input}`)
    }
}
