import { Command } from '@sapphire/framework'
import { Log } from '#config'
import { completedReq } from '#api/completedReq'

export class queueCompleted extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'queueCompleted',
            aliases: [''],
            description:
                'Generate the range of time to check for them to be completed.',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('queuecompleted')
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
        await interaction.deferReply()
        var userid = interaction.user.id
        Log.Green(`${userid} has used the queueCompleted command.`)
        await new completedReq().restartedCheck(interaction)
    }
}
