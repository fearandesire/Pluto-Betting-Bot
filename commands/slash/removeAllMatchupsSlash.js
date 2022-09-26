import { Command } from '@sapphire/framework'
import { msgBotChan } from '#botUtil/msgBotChan'
import { removeAllMatchups } from '#utilMatchups/removeAllMatchups'
import { statcord } from '#main'

export class removeAllMatchupsSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'removeAllMatchupsSlash',
            aliases: [''],
            description: 'Remove all matchups currently in the database & cache',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('removeallmatchups')
                    .setDescription(this.description),
            { idHints: [`1023342000562516019`] },
        )
    }
    async chatInputRun(interaction) {
        var userid = interaction.user.id
        statcord.postCommand(`Remove All Matchups`, userid)
        await msgBotChan(
            `Clearing all matchups -- Requested by ${interaction.user.username}`,
        )
        await removeAllMatchups()
        return
    }
}
