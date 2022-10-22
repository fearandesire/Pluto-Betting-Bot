import { _, gamesScheduled } from '#config'

import { Command } from '@sapphire/framework'
import { embedReply } from '#embed'
import { isMod } from '#botUtil/isMod'

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
        if (_.isEmpty(gamesScheduled) && isMod(interaction)) {
            await interaction.reply(
                `There are currently no game channels scheduled. If there should be, please run \`/callschedule\` to create the automatic game channel schedule for today's games.`,
            )
            return
        } else if (_.isEmpty(gamesScheduled) && !isMod(interaction)) {
            await interaction.reply(`There are currently no game channels scheduled.`)
            return
        } else {
            var embObj = {
                title: `Scheduled Game Channels`,
                description: gamesScheduled.join(`\n`),
                color: `#00FF00`,
                target: `reply`,
                footer: `Above are the start time's the games will begin per the NBA schedule. The game channels will be created an hour ahead of the game's start time. All times listed are in EST.`,
            }
            await embedReply(interaction, embObj)
            return
        }
    }
}
