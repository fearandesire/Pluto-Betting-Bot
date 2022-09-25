import { Command } from '@sapphire/framework'
import { isModSlash } from './../../utils/bot_res/isModSlash.js'
import { returnAllMatchups } from '../../utils/cache/returnAllMatchups.js'

export class allMatchupsSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'allMatchupsSlash',
            aliases: [''],
            description:
                'View all matchups & their Match IDs -- Management & Debugging Purposes',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('allmatchups')
                    .setDescription(this.description)
                    .addBooleanOption((option) =>
                        option //
                            .setName('debug')
                            .setDescription(
                                'OPTIONAL: Debug Matchups from Cache to Console | True Or False',
                            ),
                    ),
            { idHints: [`1022948082394075156`] },
        )
    }
    async chatInputRun(interaction) {
        if ((await isModSlash(interaction)) === false) {
            await interaction.reply({
                content: `**You do not have permission to use this command.**`,
                ephemeral: true,
            })
            return
        }
        //var userid = interaction.user.id
        var debugBoolean
        if (
            !interaction.options.getBoolean('debug') ||
            interaction.options.getBoolean('debug') !== `true` ||
            interaction.options.get('debug') !== true
        ) {
            debugBoolean = false
        }
        if (
            interaction.options.getBoolean('debug') === `true` ||
            interaction.options.getBoolean('debug') === true
        ) {
            debugBoolean = true
        }
        await returnAllMatchups(interaction, debugBoolean)
    }
}
