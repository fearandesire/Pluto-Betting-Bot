import { Command } from '@sapphire/framework'
import { validateUser } from '@pluto-validate/validateExistingUser.js'
import { fetchBetHistory } from '../utils/db/fetchBetHistory.js'

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
					.setDescription(this.description)
					.setDMPermission(false),
			//    { idHints: [`1022940422974226432`] },
		)
	}

	async chatInputRun(interaction) {
		await interaction.deferReply({ ephemeral: false })
		const userid = interaction.user.id
		const interactionEph = false
		await validateUser(
			interaction,
			userid,
			interactionEph,
		)
		await fetchBetHistory(interaction, userid)
	}
}
