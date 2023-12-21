import { Command } from '@sapphire/framework'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import db from '@pluto-db'
import BetProcessor from '../../utils/db/betOps/BetProcessor.js'

export class UserCommand extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'forceclosebets',
			aliases: [''],
			description: 'Start bet closing',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName('forceclosebets')
				.setDescription(this.description)
				.setDMPermission(false),
		)
	}

	async chatInputRun(interaction) {
		// Get all current matchups stored
		const matchups =
			await MatchupManager().getAllMatchups()

		try {
			await db.tx('forceCloseBets', async (t) => {
				// Loop through all matchups, collect bets for them
				for await (const matchup of matchups) {
					const { winner, loser } = matchup
					// Close bets
					await new BetProcessor(t).closeBets(
						winner,
						loser,
						matchup,
					)
				}
			})
		} catch (error) {
			console.log(error)
		}
		await interaction.reply({
			content: 'Closed all bets',
			ephemeral: true,
		})
	}
}
