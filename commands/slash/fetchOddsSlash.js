import { Command } from '@sapphire/framework'
import { collectOdds } from '../../utils/api/collectOdds.js'

export class fetchOddsSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'fetchOddsSlash',
            aliases: [''],
            description:
                'Fetch all odds for the week manually. Please note this is automatically performed every week.',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('fetchallodds')
                    .setDescription(this.description),
            //    { idHints: [`1022940422974226432`] },
        )
    }
    async chatInputRun(interaction) {
        await interaction.deferReply()
        if (!interaction.guildId) {
            interaction.reply({
                content: `This command can only be used in a server.`,
                ephemeral: true,
            })
            return
        }
        var userid = interaction.user.id
        await collectOdds(interaction)
    }
}
