import { Command } from '@sapphire/framework'
import { MatchupManager } from '#MatchupManager'

export class removeAllMatchupsSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'removeAllMatchupsSlash',
			aliases: [''],
			description:
				'Use with caution: This will clear this weeks current matchups from the database.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('clear_matchups')
					.setDescription(this.description)
					.setDMPermission(false),
			{ idHints: [`1023342000562516019`] },
		)
	}

	async chatInputRun(interaction) {
		if (!interaction.guildId) {
			interaction.reply({
				content: `This command can only be used in a server.`,
				ephemeral: true,
			})
			return
		}
		await interaction.reply({
			content: `Clearing all matchups in the database.`,
			ephemeral: true,
		})
		await MatchupManager().clearOddsTable()
	}
}
