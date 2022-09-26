import { Command } from '@sapphire/framework'
import { checkbalance } from '#utilValidate/checkbalance'
import { statcord } from '#main'
import { validateUser } from '#utilValidate/validateExistingUser'

export class balanceSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'balanceSlash',
            aliases: [''],
            description: 'View the balance of a user',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('balance')
                    .setDescription(this.description)
                    .addMentionableOption((option) =>
                        option //
                            .setName('user')
                            .setDescription(
                                'OPTIONAL: User to view balance of | If left empty, will view your own balance',
                            ),
                    ),
            { idHints: [`1022954913489223690`] },
        )
    }
    async chatInputRun(interaction) {
        var userOption = interaction.options.getMentionable('user')
        const userid = interaction.user.id
        statcord.postCommand(`Balance`, userid)
        if (!userOption) {
            await validateUser(interaction, userid)
            await checkbalance(userid, interaction)
            return
        }
        if (userOption) {
            const notuser = true
            await checkbalance(userid, interaction, notuser) // reinstalls checkbalance function
            return
        }
    }
}
