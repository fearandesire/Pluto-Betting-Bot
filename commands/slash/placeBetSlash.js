import { Command } from '@sapphire/framework'
import { newBet } from '../../utils/db/newBet.js'

export class placeBetSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'placeBetSlash',
            aliases: [''],
            description:
                "Place a bet on a matchup. Use the /odds command to view this week's NFL Games!",
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('bet')
                    .setDescription(this.description)
                    .addStringOption((option) =>
                        option //
                            .setName('team')
                            .setDescription('The team you are placing your bet on')
                            .setRequired(true),
                    )
                    .addIntegerOption((option) =>
                        option //
                            .setName('amount')
                            .setDescription('The amount of money you are betting')
                            .setRequired(true),
                    ),
            { idHints: [`1022572274546651337`] },
        )
    }
    async chatInputRun(interaction) {
        //console.log(interaction.user.id)
        if (!interaction.options.getString('team')) {
            interaction.reply({
                content: `**Please provide a team to bet on.**`,
                ephemeral: true,
            })
            return
        }
        if (interaction.options.getString(`team`).match(/^[0-9]+$/)) {
            interaction.reply({
                content: `**Please provide a valid team.**`,
                ephemeral: true,
            })
            return
        }
        if (!interaction.options.getInteger('amount')) {
            interaction.reply({
                content: `**Please provide an amount to bet.**`,
                ephemeral: true,
            })
            return
        }
        var interactionEph = true
        await newBet(
            interaction,
            interaction.options.getString('team'),
            interaction.options.getInteger('amount'),
            interactionEph,
        )
    }
}
