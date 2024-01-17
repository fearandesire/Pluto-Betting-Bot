import { Command } from '@sapphire/framework'
import { newBet } from '@pluto-betOps/newBet.js'
import { validateUser } from '@pluto-validate/validateExistingUser.js'
import { isPreSzn } from '@pluto-core-config'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import { QuickError } from '@pluto-embed-reply'
import PendingBetHandler from '../utils/db/validation/pendingBet.js'
import isInGuild from '../utils/isInGuild.js'

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
					.setDMPermission(false)
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
		await isInGuild(interaction)

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
		try {
			const isRegistered = await validateUser(
				interaction,
				userid,
				true,
			)
			if (!isRegistered) return

			const oddsExist =
				await MatchupManager.getAllMatchups()
			if (!oddsExist) {
				return interaction.editReply({
					content: `No odds are currently stored, you cannot place a bet.`,
					ephemeral: true,
				})
			}
			const hasPending =
				await PendingBetHandler.checkPending(userid)
			if (hasPending) {
				return interaction.editReply({
					content: `You are already setting up another bet. Please finish that bet before placing another.`,
					ephemeral: false,
				})
			}

			const teamName =
				interaction.options.getString(`team`)
			// Use a regex to check if the team name is a number
			if (teamName.match(/^[0-9]+$/)) {
				return interaction.editReply({
					content: `**Please provide a valid team.**`,
					ephemeral: true,
				})
			}

			// If all checks pass, insert the pending bet
			await PendingBetHandler.insertPending(userid)
			// Call the newBet function only if all checks pass
			await newBet(
				interaction,
				teamName,
				interaction.options.getInteger('amount'),
			)
		} catch (error) {
			await PendingBetHandler.deletePending(userid)
			// Handle any errors that occur during the promise chain
			console.error(error)
			if (error?.code === `MATCH_NOT_FOUND`) {
				return QuickError(
					interaction,
					`Unable to locate odds for the team you specified.\nVerify available games via \`/odds\``,
				)
			}
			return QuickError(
				interaction,
				error?.message ||
					`An error occurred while processing your bet.`,
			)
		}
	}
}
