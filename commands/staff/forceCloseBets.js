import { Command } from '@sapphire/framework'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import { db } from '@pluto-db'
import { closeBets } from '../../utils/db/betOps/closeBets/closeBets'

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

		await db.tx('forceCloseBets', async (t) => {
			// Loop through all matchups, collect bets for them
			for await (const matchup of matchups) {
				const { winner, loser } = matchup
				// Close bets
				await closeBets(winner, loser, matchup, t)
			}
		})
		await interaction.reply({
			content: 'Closed all bets',
			ephemeral: true,
		})
	}
}
