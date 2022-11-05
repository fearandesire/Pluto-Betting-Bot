import { Command } from '@sapphire/framework'
import { createChannel } from '../../utils/db/gameSchedule/createChannel.js'

export class createChan extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'createChan',
            aliases: [''],
            description:
                'Create a channel manually. Please use this as a last resort, channels are managed automatically.',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand((builder) =>
            builder //
                .setName('createchan')
                .setDescription(this.description)
                //    { idHints: [`1022940422974226432`] },
                .addStringOption((option) =>
                    option //
                        .setName('home_team')
                        .setDescription('Home Team')
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option //
                        .setName('away_team')
                        .setDescription('Away Team')
                        .setRequired(true),
                ),
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
        var homeTeam = interaction.options.getString('home_team')
        var awayTeam = interaction.options.getString('away_team')
        await createChannel(homeTeam, awayTeam)
            .then((result) => {
                interaction.reply({ content: `${result}`, ephemeral: true })
                return
            })
            .catch((err) => {
                interaction.reply({
                    content: `There was an error creating the channel. Please try again.`,
                    ephemeral: true,
                })
                return
            })
    }
}
