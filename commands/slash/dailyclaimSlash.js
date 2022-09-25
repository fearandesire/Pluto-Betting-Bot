import { Command } from '@sapphire/framework'
import { processClaim } from '#utilDB/processClaim'

export class dailyClaimSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'dailyClaimSlash',
            aliases: [''],
            description: 'Claim $100 dollars every 24 hours.',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('dailyclaim')
                    .setDescription(this.description),
            { idHints: [`1022940422974226432`] },
        )
    }
    async chatInputRun(interaction) {
        var userid = interaction.user.id
        var currentTime = new Date().getTime()
        processClaim(userid, interaction, currentTime)
    }
}
