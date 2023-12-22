/* eslint-disable no-await-in-loop */
import { Command } from '@sapphire/framework'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import db from '@pluto-db'
import BetProcessor from '../../utils/db/betOps/BetProcessor.js'
import { Log } from '@pluto-internal-logger';

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
		await interaction.deferReply({ ephemeral: true })
		await interaction.followUp(`Closing bets...`)
		// Get all current matchups stored
		const matchups =
			await MatchupManager.getAllMatchups()
		try {
			await db.tx('forceCloseBets', async (t) => {
				const betProcessor = new BetProcessor(t)
				// Loop through all matchups, collect bets for them
				for (const matchup of matchups) {
					const { winner, loser } = matchup
					// Close bets
					await Log.Green(`[forceClose]\nInit for ${winner} vs ${loser}\nID: ${matchup.id}`)
					await betProcessor.closeBets(
						winner,
						loser,
						matchup,
					)
				}
			})
		} catch (error) {
			console.log(error)
		}
		await interaction.followUp({
			content: 'Closed all bets',
			ephemeral: true,
		})
	}
}
