import { Command } from '@sapphire/framework'
import { returnOddsFor } from '#cacheUtil/returnOddsFor'
import { isPreSzn } from '#config'

export class oddsForSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'oddsForSlash',
			aliases: [''],
			description:
				'View odds for a specific matchup / team',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('oddsfor')
					.setDescription(this.description)
					.addStringOption((option) =>
						option //
							.setName('team')
							.setDescription(
								'Team to view odds for',
							)
							.setRequired(true),
					),
			{ idHints: [`1023326220932362300`] },
		)
	}

	async chatInputRun(interaction) {
		if (isPreSzn()) {
			return interaction.reply({
				content: `This is unavailable in the preseason.`,
				ephemeral: true,
			})
		}
		const team = interaction.options.getString(`team`)
		await returnOddsFor(interaction, team)
	}
}
