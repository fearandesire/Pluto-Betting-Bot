import { Command } from '@sapphire/framework'
import { fetchBetHistory } from '../../utils/db/fetchBetHistory.js'
import { validateUser } from '#utilValidate/validateExistingUser'

export class betHistorySlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'betHistorySlash',
            aliases: [''],
            description: 'View the history of your bets',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('bethistory')
                    .setDescription(this.description),
            //    { idHints: [`1022940422974226432`] },
        )
    }
    async chatInputRun(interaction) {
        const userid = interaction.user.id
        var interactionEph = true
        await validateUser(interaction, userid, interactionEph)
        await fetchBetHistory(interaction, userid, interactionEph)
    }
}
