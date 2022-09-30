import { Command } from '@sapphire/framework'
import { registerUser } from '#register'

export class registerSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'registerSlash',
			aliases: [''],
			description: 'Create an account with Pluto',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('register')
					.setDescription(this.description),
			//    { idHints: [`1022940422974226432`] },
		)
	}
	async chatInputRun(interaction) {
		var userid = interaction.user.id
		var inform = true
		var interactionEph = true
		await registerUser(interaction, userid, inform, interactionEph)
	}
}
