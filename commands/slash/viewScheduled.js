import { _, gamesScheduled } from '#config'

import { Command } from '@sapphire/framework'
import { embedReply } from '#embed'

export class viewScheduled extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'viewScheduled',
            aliases: [''],
            description: 'View the scheduled game channels.',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('viewscheduled')
                    .setDescription(this.description),
            //    { idHints: [`1022940422974226432`] },
        )
    }
    async chatInputRun(interaction) {
        var userid = interaction.user.id
        if (_.isEmpty(gamesScheduled)) {
            await interaction.reply(
                `There are currently no game channels scheduled. If there should be, please run \`/callschedule\` to create the automatic game channel schedule for today's games.`,
            )
            return
        } else {
            var embObj = {
                title: `Scheduled Game Channels`,
                description: gamesScheduled.join(`\n`),
                color: `#00FF00`,
                target: `reply`,
            }
            await embedReply(interaction, embObj)
            return
        }
    }
}
