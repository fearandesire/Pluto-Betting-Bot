import { Command } from '@sapphire/framework'
import { newBet } from '#utilBetOps/newBet'
import { validateUser } from '#utilValidate/validateExistingUser'
import { isPreSzn } from '#config'
import { pendingBet } from '../../utils/db/validation/pendingBet.js'

export class bet extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'bet',
			aliases: [''],
			description:
				"💰 Place a bet on a matchup. Use the /odds command to view this week's Games!",
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.addStringOption((option) =>
						option //
							.setName('team')
							.setDescription(
								'The team you are placing your bet on',
							)
							.setRequired(true),
					)
					.addIntegerOption((option) =>
						option //
							.setName('amount')
							.setDescription(
								'💰 The amount of money you are betting',
							)
							.setRequired(true),
					),
			{ idHints: [`1022572274546651337`] },
		)
	}

	async chatInputRun(interaction) {
		if (isPreSzn()) {
			return interaction.reply({
				content: `This is unavailable in the preseason.`,
				ephemeral: true,
			})
		}
		await interaction.deferReply({
			content: `Submitting your bet, please wait.`,
		})
		const userid = interaction.user.id

		const isRegistered = await validateUser(
			interaction,
			userid,
			true,
		)
		if (!isRegistered) return
		const hasPending =
			await new pendingBet().checkPending(userid)
		if (hasPending) {
			await interaction.editReply({
				content: `You are already setting up another bet. Please finish that bet before placing another.`,
				ephemeral: false,
			})

			// regex to check if the team name is a number
		} else if (
			interaction.options
				.getString(`team`)
				.match(/^[0-9]+$/)
		) {
			interaction.editReply({
				content: `**Please provide a valid team.**`,
				ephemeral: true,
			})
		} else {
			await new pendingBet().insertPending(userid)
			await newBet(
				interaction,
				interaction.options.getString('team'),
				interaction.options.getInteger('amount'),
			)
		}
	}
}
