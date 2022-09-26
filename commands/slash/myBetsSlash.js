import { Command } from '@sapphire/framework'
import { checkBetsCache } from '../../utils/cache/checkBetsCache.js'
import { statcord } from '#main'
import { validateUser } from '#utilValidate/validateExistingUser'

export class myBetsSlash extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'myBetsSlash',
            aliases: [''],
            description: 'View your currently active bets',
            chatInputCommand: {
                register: true,
            },
        })
    }

    registerApplicationCommands(registry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName('mybets')
                    .setDescription(this.description),
            { idHints: [`1023323729540952075`] },
        )
    }
    async chatInputRun(interaction) {
        var userid = interaction.user.id
        statcord.postCommand(`My Bets`, userid)
        var interactionEph = true
        await validateUser(interaction, userid)
        await checkBetsCache(interaction, userid, interactionEph)
    }
}
