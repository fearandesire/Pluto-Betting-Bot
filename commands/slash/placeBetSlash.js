import { Command } from '@sapphire/framework'
import { newBet } from '#utilBetOps/newBet'
import { pendingBet } from '../../utils/db/validation/pendingBet.js'

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
        var userid = interaction.user.id
        var hasPending = await new pendingBet().checkPending(userid)
        if (hasPending) {
            interaction.reply({
                content: `You are already setting up another bet. Please finish that bet before placing another.`,
                ephemeral: true,
            })
            return
        } else {
            await new pendingBet().insertPending(userid)
        }
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
