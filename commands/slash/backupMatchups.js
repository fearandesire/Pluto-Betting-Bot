import { Command } from '@sapphire/framework'
import { saveMatchups } from '../../utils/db/backup/saveMatchups.js'

export class backupMatchups extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'backupMatchups',
            aliases: [''],
            description: 'Backup Matchups from the Database into Cache',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('backupmatchups')
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
        await saveMatchups()
        interaction.reply({
            content: 'Matchups have been backed up',
            ephemeral: true,
        })
    }
}
