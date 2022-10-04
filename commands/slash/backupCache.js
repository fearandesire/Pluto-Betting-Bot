import { Command } from '@sapphire/framework'
import { Log } from '#config'
import { backupOddsCache } from '../../utils/cache/backupOddsCache.js'

export class backupCache extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'backupCache',
            aliases: [''],
            description:
                'Backup the weekly odds cache file - Note this occurs automatically',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('backupcache')
                    .setDescription(this.description),
            //    { idHints: [`1022940422974226432`] },
        )
    }
    async chatInputRun(interaction) {
        var userid = interaction.user.id
        Log.Yellow(`Backup of Weekly Odds Cache File Initiated by ${userid}`)
        await backupOddsCache().then((res) => {
            if (res === true) {
                interaction.reply({
                    content: 'Cache has been backed up',
                    ephemeral: true,
                })
                return
            } else {
                interaction.reply({
                    content: 'Cache backup failed',
                    ephemeral: true,
                })
            }
            return
        })
    }
}
