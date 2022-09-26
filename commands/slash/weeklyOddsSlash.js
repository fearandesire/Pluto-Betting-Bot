import { Command } from '@sapphire/framework'
import { returnWeeklyOdds } from '../../utils/cache/returnWeeklyOdds.js'
import { statcord } from '#main'

export class weeklyOddsSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'weeklyOddsSlash',
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
                    .setName('weeklyodds')
                    .setDescription(this.description),
            //    { idHints: [`1022940422974226432`] },
        )
    }
    async chatInputRun(interaction) {
        var userid = interaction.user.id
        statcord.postCommand(`Daily Claim`, userid)
        var interactionEph = true
        await returnWeeklyOdds(interaction, interactionEph)
    }
}
