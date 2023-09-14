import { Command } from '@sapphire/framework'
import { isPreSzn } from '#config'
import returnOdds from '../utils/bot_res/betOps/returnOdds.js'

export class odds extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'odds',
			aliases: [''],
			description:
				'🔎 View the matchups & odds for the entire week',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('odds')
					.setDescription(this.description),
			//    { idHints: [`1022940422974226432`] },
		)
	}

	async chatInputRun(interaction) {
		if (isPreSzn()) {
			return interaction.reply({
				content: `This is unavailable in the preseason.`,
				ephemeral: true,
			})
		}
		await interaction.deferReply({ ephemeral: true })
		await returnOdds(interaction)
	}
}
