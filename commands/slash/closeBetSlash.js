import { Command } from '@sapphire/framework'
import { initCloseMatchups } from '#utilMatchups/initCloseMatchups'
import { isModSlash } from '#botUtil/isModSlash'

export class closeMatchupSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'closeMatchupSlash',
            aliases: [''],
            description:
                'Manually close a matchup via the ID of the matchup. Retrieve matchup IDs with /allmatchups',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('closematchup')
                    .setDescription(this.description)
                    .addIntegerOption((option) =>
                        option
                            .setName('matchid')
                            .setDescription('The ID of the matchup to close')
                            .setRequired(true),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('winner')
                            .setDescription('The winner of the matchup')
                            .setRequired(true),
                    ),
            { idHints: [`1023285162647240775`] },
        )
    }
    async chatInputRun(interaction) {
        console.log(`ABC ABC ABC`)
        var userid = interaction.user.id
        if ((await isModSlash(interaction)) === false) {
            interaction.reply({
                content: 'You do not have permission to use this command',
                ephemeral: true,
            })
            return
        }
        var matchId = interaction.options.getInteger(`matchid`)
        var winner = interaction.options.getString(`winner`)
        await initCloseMatchups(interaction, matchId, winner)
    }
}
