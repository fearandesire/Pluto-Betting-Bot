import { Command } from '@sapphire/framework'
import { Log } from '#config'
import { fetchSchedule } from '../../utils/db/gameSchedule/fetchSchedule.js'

export class callSchedule extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'callSchedule',
            aliases: [''],
            description:
                'Setup Game Channels to be created. Performed automatically, but can be called manually.',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('callschedule')
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
        var userid = interaction.user.id
        Log.Yellow(`User ${userid} called the callSchedule cmd`)
        await interaction.deferReply()
        await fetchSchedule(interaction)
    }
}
