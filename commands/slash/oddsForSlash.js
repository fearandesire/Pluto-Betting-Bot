import { Command } from '@sapphire/framework'
import { QuickError } from '#embed'
import { returnOddsFor } from '#cacheUtil/returnOddsFor'
import { sanitizeToSlash } from './../../utils/date/sanitizeToSlash.js'

export class oddsForSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'oddsForSlash',
            aliases: [''],
            description: 'View odds for a specific matchup / team',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('oddsfor')
                    .setDescription(this.description)
                    .addStringOption((option) =>
                        option //
                            .setName('team')
                            .setDescription('Team to view odds for')
                            .setRequired(true),
                    )
                    .addStringOption((option) =>
                        option //
                            .setName('date')
                            .setDescription(
                                `Date of the game. | E.g 8 or 8th, 9 or 9th, 10 or 10th, etc`,
                            )
                            .setRequired(true),
                    ),
            { idHints: [`1023326220932362300`] },
        )
    }
    async chatInputRun(interaction) {
        var team = interaction.options.getString(`team`)
        var userid = interaction.user.id
        var matchupDate = interaction.options.getString(`date`)
        var sanitize = await sanitizeToSlash(matchupDate)
        if (!sanitize || sanitize == false) {
            QuickError(
                interaction,
                `Please provide a valid date number for the day. Please do not include the month or year.\nExamples of valid inputs: \`8\` or \`8th\`, \`9\` or \`9th\`, \`10\` or \`10t\`h, etc`,
                true,
            )
            return
        }
        console.log(`date sanitized: ${sanitize}`)
        await returnOddsFor(interaction, team, sanitize)
    }
}
