import { gamesScheduled, _ } from '#config'

import { embedReply } from '#embed'
import { Command } from '@sapphire/framework'

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
        if (!interaction.guildId) {
            interaction.reply({
                content: `This command can only be used in a server.`,
                ephemeral: true,
            })
            return
        }
        if (_.isEmpty(gamesScheduled)) {
            await interaction.reply(
                `There are currently no game channels scheduled to be created.`,
            )
            return
        } else {
            var embObj = {
                title: `Scheduled Game Channels`,
                description: gamesScheduled.join(`\n`),
                color: `#00FF00`,
                target: `reply`,
                footer: `The game channels will be created an hour ahead of the game's start time. All start times listed are in EST.`,
            }
            await embedReply(interaction, embObj)
            return
        }
    }
}
