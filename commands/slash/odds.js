import { Command } from '@sapphire/framework'
import { returnWeeklyOdds } from '../../utils/cache/returnWeeklyOdds.js'

export class odds extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'odds',
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
                    .setName('odds')
                    .setDescription(this.description),
            //    { idHints: [`1022940422974226432`] },
        )
    }
    async chatInputRun(interaction) {
        var userid = interaction.user.id
        var interactionEph = true
        await returnWeeklyOdds(interaction, interactionEph)
    }
}
