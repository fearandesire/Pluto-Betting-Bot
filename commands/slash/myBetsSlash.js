import { Command } from '@sapphire/framework'
import { checkBetsCache } from '../../utils/cache/checkBetsCache.js'
import { validateUser } from '#utilValidate/validateExistingUser'
import { isPreSzn } from '#config'

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
        if (isPreSzn) {
            return interaction.reply({
                content: `It's currently the preseason so this command has been disabled for now! Please wait for the season to begin.`,
            })
        }
        const userid = interaction.user.id
        const interactionEph = true
        await validateUser(interaction, userid, true)
        await checkBetsCache(
            interaction,
            userid,
            interactionEph,
        )
    }
}
