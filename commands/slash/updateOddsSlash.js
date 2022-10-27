import { Command } from '@sapphire/framework'
import { updateOdds } from '#botUtil/updateOdds'

export class updateOddsSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'updateOddsSlash',
			aliases: [''],
			description:
				'Request the API to update all odds. Performed automatically, but can be done manually.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('updateodds')
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
		await updateOdds().then(() => {
			interaction.reply({
				content: `All odds have been updated.`,
				ephemeral: true,
			})
		})
	}
}
