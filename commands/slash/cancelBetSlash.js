import { Command } from '@sapphire/framework'
import { queryBets } from '#utilBetOps/queryBets'
import { validateUser } from '#utilValidate/validateExistingUser'
import { verifyBetAuthor } from '#utilValidate/verifyBetAuthor'
import { verifyCancellation as invalidCancel } from '../../utils/db/betOps/verifyCancellation.js'

export class cancelBetSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'cancelBetSlash',
			aliases: [''],
			description:
				'Cancel a bet you have placed via the bet ID. View your bet IDs with the /mybets command.',
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
		await invalidCancel(userid, betId).then(
			async (response) => {
				if (response === true) {
					interaction.reply({
						content: `**You cannot cancel a bet on a game that has already started.**`,
						ephemeral: true,
					})
				} else {
					await queryBets(
						interaction,
						userid,
						betId,
					) // ? Query DB & delete specified bet
				}
			},
		)
	}
}
