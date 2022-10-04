import { Command } from '@sapphire/framework'
import { transferTo } from '#utilCurrency/transferBetween'
import { validateUser } from '#utilValidate/validateExistingUser'

export class giveMoneySlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'giveMoneySlash',
            aliases: [''],
            description: 'Give money to a specified user from your balance',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('give')
                    .setDescription(this.description)
                    .addMentionableOption((option) =>
                        option //
                            .setName('user')
                            .setDescription('User to give money to')
                            .setRequired(true),
                    )
                    .addIntegerOption((option) =>
                        option //
                            .setName('amount')
                            .setDescription(
                                'Amount of money to give (takes the money from your balance)',
                            )
                            .setRequired(true),
                    ),
            { idHints: [`1023303824888307863`] },
        )
    }
    async chatInputRun(interaction) {
        var userId = interaction.user.id
        var targetId = interaction.options.getMentionable('user').user.id
        var amount = interaction.options.getInteger('amount')
        if (amount < 1) {
            interaction.reply({
                content: 'Please provide a valid amount.',
                ephemeral: true,
            })
            return
        }
        await validateUser(interaction, userId, true)
        await transferTo(interaction, userId, targetId, amount, true)
    }
}
