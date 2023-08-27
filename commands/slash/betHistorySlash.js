import { Command } from '@sapphire/framework'
import { validateUser } from '#utilValidate/validateExistingUser'
import { isPreSzn } from '#config'
import { fetchBetHistory } from '../../utils/db/fetchBetHistory.js'

export class betHistorySlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'betHistorySlash',
			aliases: [''],
			description: 'View the history of your bets',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('bethistory')
					.setDescription(this.description),
			//    { idHints: [`1022940422974226432`] },
		)
	}

	async chatInputRun(interaction) {
		if (isPreSzn) {
			return interaction.reply({
				content: `This command is disabled during the preseason`,
				ephemeral: true,
			})
		}
		const userid = interaction.user.id
		const interactionEph = true
		await validateUser(
			interaction,
			userid,
			interactionEph,
		)
		await fetchBetHistory(
			interaction,
			userid,
			interactionEph,
		)
	}
}
