import { Command } from '@sapphire/framework'
import cronstrue from 'cronstrue'
import { container } from '#config'

export class fetchCronRanges extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'fetchCronRanges',
            aliases: [''],
            description:
                'Return the time ranges Pluto will check for completed matches.',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('cronranges')
                    .setDescription(this.description),
            //    { idHints: [`1022940422974226432`] },
        )
    }

    async chatInputRun(interaction) {
        const { cronRanges } = container
        if (!interaction.guildId) {
            interaction.reply({
                content: `This command can only be used in a server.`,
                ephemeral: true,
            })
            return
        }
        if (!cronRanges || cronRanges.length === 0) {
            interaction.reply({
                content: `The time ranges have not been collected.\nPlease use the \`/queuecompleted\` command to collect them.`,
                ephemeral: true,
            })
            return
        }
        if (
            cronRanges &&
            cronRanges.range1 &&
            cronRanges.range2
        ) {
            await interaction.reply({
                content: `Pluto will check for completed matches between ${cronstrue.toString(
                    `${cronRanges.range1}`,
                )} and ${cronstrue.toString(
                    `${cronRanges.range2}`,
                )}`,
                ephemeral: true,
            })
        } else if (
            cronRanges &&
            cronRanges.range1 &&
            !cronRanges.range2
        ) {
            await interaction.reply({
                content: `Pluto will check for completed matches between ${cronstrue.toString(
                    `${cronRanges.range1}`,
                )}`,
                ephemeral: true,
            })
        }
    }
}
