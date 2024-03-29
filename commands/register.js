import { Command } from '@sapphire/framework'
import { registerUser } from '@pluto-db-utils/registerUser.js'

export class registerSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'register',
			aliases: [''],
			description: '👤 Create an account with Pluto',
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
					.setDescription(this.description)
					.setDMPermission(false),
			//    { idHints: [`1022940422974226432`] },
		)
	}

	async chatInputRun(interaction) {
		const userid = interaction.user.id
		const inform = true
		await registerUser(interaction, userid, inform)
	}
}
