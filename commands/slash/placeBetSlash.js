import { Command } from '@sapphire/framework'
import { newBet } from '#utilBetOps/newBet'

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
                    )
                    .addStringOption((option) =>
                        option //
                            .setName('date')
                            .setDescription(
                                'The date the game of the game. | E.g 8 or 8th, 9 or 9th, 10 or 10th, etc',
                            )
                            .setRequired(true),
                    ),
            { idHints: [`1022572274546651337`] },
        )
    }
    async chatInputRun(interaction) {
        //console.log(interaction.user.id)
        var userid = interaction.user.id
        var betOnTeam = interaction.options.getString('team')
        var betAmount = interaction.options.getInteger('amount')
        var gameDate = interaction.options.getString('date')
        if (betOnTeam.match(/^[0-9]+$/) && betOnTeam.toLowerCase() !== `76ers`) {
            interaction.reply({
                content: `**Please provide a valid team.**`,
                ephemeral: true,
            })
            return
        }
        var interactionEph = true
        await newBet(interaction, betOnTeam, betAmount, gameDate, interactionEph)
    }
}
