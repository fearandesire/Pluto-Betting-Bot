import { Command } from '@sapphire/framework'
import { isPreSzn } from '#config'
import { returnOdds } from '../../utils/cache/returnOdds.js'

export class dailyOdds extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'dailyOdds',
			aliases: [''],
			description: 'View available matchups & odds',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('dailyodds')
					.setDescription(this.description),
			{ idHints: [`1033408964534214746`] },
		)
	}

	async chatInputRun(interaction) {
		if (isPreSzn) {
			return interaction.reply({
				content: `It's currently the preseason, no bets can be placed! Please wait for the season to begin.`,
			})
		}
		const userid = interaction.user.id
		const interactionEph = true
		await returnOdds(interaction, interactionEph)
	}
}