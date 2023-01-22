import { leaderboard } from '#utilCurrency/leaderboard'
import { Command } from '@sapphire/framework'
import { reply } from '#botUtil/reply'

export class leaderboardSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'leaderboardSlash',
            aliases: [''],
            description: 'View the current betting leaderboard',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('leaderboard')
                    .setDescription(this.description),
            { idHints: [`1023293710567481536`] },
        )
    }
    async chatInputRun(interaction) {
        var userid = interaction.user.id
        await interaction.deferReply({ ephemeral: true })
        await reply(interaction, {
            content: `Collecting the leaderboard, this take 1 minute. I'll ping you when it's ready!`,
        })
        var interactionEph = true
        await leaderboard(interaction, interactionEph)
    }
}
