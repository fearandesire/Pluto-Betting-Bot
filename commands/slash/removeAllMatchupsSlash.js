import { Command } from '@sapphire/framework'
import { msgBotChan } from '../../utils/bot_res/send_functions/msgBotChan.js'
import { removeAllMatchups } from '#utilDB/removeAllMatchups'

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
        await msgBotChan(
            `Clearing all matchups -- Requested by ${interaction.user.username}`,
        )
        await removeAllMatchups()
        return
    }
}
