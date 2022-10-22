import { Command } from '@sapphire/framework'
import { returnDailyOdds } from '../../utils/cache/returnDailyOdds.js'

export class dailyOdds extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'dailyOdds',
            aliases: [''],
            description: 'View the matchups & odds for the entire week',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('dailyodds')
                    .setDescription(this.description),
            { idHints: [`1033408964534214746`] },
        )
    }
    async chatInputRun(interaction) {
        var userid = interaction.user.id
        var interactionEph = true
        await returnDailyOdds(interaction, interactionEph)
    }
}
