import { Command } from '@sapphire/framework'
import { QuickError } from '#embed'
import { modifyAmount } from '#utilBetOps/modifyAmount'
import { validateUser } from '#utilValidate/validateExistingUser'
import { verifyBetAuthor } from '#utilValidate/verifyBetAuthor'
import { verifyCancellation } from '#utilBetOps/verifyCancellation'

export class changeBetSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'changeBetSlash',
            aliases: [''],
            description: 'Change the amount of money you put on a specified bet',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('changebet')
                    .setDescription(this.description)
                    .addIntegerOption((option) =>
                        option //
                            .setName('betid')
                            .setDescription(
                                'The ID of the bet you are wanting to change. Retrieve your bet IDs with the /mybets command.',
                            )
                            .setRequired(true),
                    )
                    .addIntegerOption((option) =>
                        option //
                            .setName('amount')
                            .setDescription(
                                'The amount of money you are changing your bet to.',
                            )
                            .setRequired(true),
                    ),
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
        var betId = interaction.options.getInteger('betid')
        var amount = interaction.options.getInteger('amount')
        if (amount < 1) {
            interaction.reply({
                content: `You cannot bet less than $1.`,
                ephemeral: true,
            })
            return
        }
        await validateUser(interaction, userid, true) //? Validate the user exists in our DB
        var interactionEph = true //? client-side / silent reply
        var betVerificaiton = await verifyBetAuthor(
            interaction,
            userid,
            betId,
            interactionEph,
        ) //? Verify the bet belongs to the user
        if (betVerificaiton == false) {
            interaction.reply({
                content: `**You do not have a bet with that ID.**`,
                ephemeral: true,
            })
            return
        } else {
            await verifyCancellation(userid, betId).then(async (response) => {
                if (response == true) {
                    QuickError(
                        interaction,
                        `It's too late to change your bet. This game has already started.`,
                        true,
                    )
                    return
                } else if (response == false) {
                    await modifyAmount(interaction, userid, betId, amount, interactionEph) //? Modify the bet amount
                    return
                } else {
                    QuickError(
                        interaction,
                        `Something went wrong. Please verify your information and try again.`,
                        true,
                    )
                    return
                }
            })
        }
    }
}
