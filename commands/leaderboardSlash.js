import { Command } from '@sapphire/framework'
import { leaderboard } from '#utilCurrency/leaderboard'
import { reply } from '#botUtil/reply'

export class leaderboardSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'leaderboardSlash',
			aliases: [''],
			description:
				'📊 View the current betting leaderboard',
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
		await interaction.deferReply({ ephemeral: true })
		await reply(interaction, {
			content: `Collecting the leaderboard data for you..`,
		})
		const interactionEph = true
		const lb = await leaderboard(
			interaction,
			interactionEph,
		)
		if (!lb) {
			await interaction.followUp({
				content: `It appears there's no data available for the leaderbaord right now.`,
				ephemeral: true,
			})
		}
	}
}
