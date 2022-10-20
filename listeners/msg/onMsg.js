import { Events, Listener } from '@sapphire/framework'

export class UserEvent extends Listener {
    constructor(context, options = {}) {
        super(context, {
            ...options,
            event: Events.InteractionCreate,
        })
    }
    async run(interaction) {
        //# moved to specific commands
        // if (!interaction.guildId) {
        //  interaction.reply({
        //      content: `This command can only be used in a server.`,
        //      ephemeral: true,
        //  })
        //  return
        // }
    }
}
