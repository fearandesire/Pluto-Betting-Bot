import { Command } from '@sapphire/framework'
import { checkCompleted } from '../../utils/api/checkCompleted.js'
import { Log } from '#config'

export class forceCheck extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'forceCheck',
            aliases: [''],
            description: 'Request API to check for completed games.',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('forcecheck')
                    .setDescription(this.description),
            //    { idHints: [`1022940422974226432`] },
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
        const userid = interaction.user.id
        await interaction.reply({
            content: `Requesting API to check for completed games.`,
            ephemeral: true,
        })
        Log.Yellow(`User ${userid} requested to check for completed games.`)
        await checkCompleted()
    }
}
