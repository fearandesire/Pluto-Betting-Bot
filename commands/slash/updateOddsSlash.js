import { Command } from '@sapphire/framework'
import { updateOdds } from '../../utils/db/matchupOps/updateOdds.js'

export class updateOddsSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'updateOddsSlash',
			aliases: [''],
			description: 'Update odds for all matchups',
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
		await updateOdds()
		await interaction.reply({
			content: `All Odds successfully updated!`,
		})
	}
}
