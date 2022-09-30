import { Command } from '@sapphire/framework'
import { QueryBets } from '#utilBetOps/queryBets'
import { deleteBetFromArray } from '#utilBetOps/deleteBetArr'
import { validateUser } from '#utilValidate/validateExistingUser'
import { verifyBetAuthor } from '#utilValidate/verifyBetAuthor'

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
							.setDescription('The bet you are wanting to cancel')
							.setRequired(true),
					),
			{ idHints: [`1022928178118938716`] },
		)
	}
	async chatInputRun(interaction) {
		var userid = interaction.user.id
		if (!interaction.options.getInteger('betid')) {
			interaction.reply({
				content: `**Please provide a bet to cancel via the ID`,
				ephemeral: true,
			})
			return
		}

		var betId = interaction.options.getInteger('betid')
		await validateUser(interaction, userid)
		await verifyBetAuthor(interaction, userid, betId) //? Verify the bet belongs to the user
		await QueryBets(interaction, userid, betId) //? Query DB & delete specified bet
		await deleteBetFromArray(interaction, userid, betId) //? Update our local storage with the new betslip for the user (for displaying bet info to user)
	}
}
