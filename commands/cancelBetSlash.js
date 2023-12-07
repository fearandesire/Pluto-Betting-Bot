import { Command } from '@sapphire/framework'
import { validateUser } from '#utilValidate/validateExistingUser'
import { verifyBetAuthor } from '#utilValidate/verifyBetAuthor'
import {
	PROFILES,
	BETSLIPS,
	CURRENCY,
	LIVEBETS,
} from '#config'
import BetManager from '../utils/bot_res/classes/BetManager.js'

export class cancelBetSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'cancelBetSlash',
			aliases: [''],
			description:
				'❌ Cancel a bet you have placed via the bet ID. View your bet IDs with the /mybets command.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('cancelbet')
					.setDescription(this.description)
					.addIntegerOption((option) =>
						option //
							.setName('betid')
							.setDescription(
								'The bet you are wanting to cancel',
							)
							.setRequired(true),
					),
			{ idHints: [`1022928178118938716`] },
		)
	}

	async chatInputRun(interaction) {
		const userid = interaction.user.id
		if (!interaction.options.getInteger('betid')) {
			interaction.reply({
				content: `**Please provide a bet to cancel via the ID`,
				ephemeral: true,
			})
			return
		}

		const betId =
			interaction.options.getInteger('betid')
		const isRegistered = await validateUser(
			interaction,
			userid,
		)
		if (!isRegistered) return
		await verifyBetAuthor(interaction, userid, betId) // ? Verify the bet belongs to the user
		await new BetManager({
			PROFILES,
			BETSLIPS,
			CURRENCY,
			LIVEBETS,
		}).cancelBet(interaction, userid, betId)
	}
}
