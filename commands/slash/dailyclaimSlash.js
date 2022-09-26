import { Command } from '@sapphire/framework'
import { processClaim } from '#utilBetOps/processClaim'
import { statcord } from '#main'
import { validateUser } from '#utilValidate/validateExistingUser'

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
        statcord.postCommand(`Daily Claim`, userid)
        statcord
        var currentTime = new Date().getTime()
        await validateUser(interaction, userid)
        await processClaim(userid, interaction, currentTime)
    }
}
