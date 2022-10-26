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
                "Used for when the bot restarts: Will collect the time's of today's games and generate the range of time to check for them to be completed.",
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('queueCompleted')
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
        var userid = interaction.user.id
        Log.Green(`${userid} has used the queueCompleted command.`)
        await new completedReq().restartedCheck(interaction)
    }
}
