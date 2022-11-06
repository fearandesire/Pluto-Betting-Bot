import { Command } from '@sapphire/framework'
import { dmMe } from '../../utils/bot_res/dmMe.js'
import { removeAllMatchups } from '#utilMatchups/removeAllMatchups'

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
        if (!interaction.guildId) {
            interaction.reply({
                content: `This command can only be used in a server.`,
                ephemeral: true,
            })
            return
        }
        var userid = interaction.user.id
        await dmMe(
            `Clearing all matchups -- Requested by ${interaction.user.username}`,
        )
        await interaction.reply({
            content: `Clearing all matchups in the database.`,
            ephemeral: true,
        })
        await removeAllMatchups()
        return
    }
}
