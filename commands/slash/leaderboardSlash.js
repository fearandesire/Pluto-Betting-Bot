import { Command } from '@sapphire/framework'
import { leaderboard } from '#utilCurrency/leaderboard'

export class leaderboardSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'leaderboardSlash',
			aliases: [''],
			description: 'View the current betting leaderboard',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('leaderboard')
					.setDescription(this.description),
			{ idHints: [`1023293710567481536`] },
		)
	}
	async chatInputRun(interaction) {
		var userid = interaction.user.id
		var interactionEph = true
		await leaderboard(interaction, interactionEph)
	}
}
