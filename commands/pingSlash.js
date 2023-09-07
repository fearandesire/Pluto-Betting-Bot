import { Command } from '@sapphire/framework'

export class pingSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'pingSlash',
			aliases: [''],
			description: 'Ping Pong!',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('ping')
					.setDescription(this.description),
			//    { idHints: [`1022940422974226432`] },
		)
	}

	async chatInputRun(interaction) {
		await interaction.reply({
			content: 'Pong!',
			ephemeral: true,
		})
	}
}
