import { Command } from '@sapphire/framework'
import { MessageEmbed } from 'discord.js'
import { format } from 'date-fns'
import { _ } from '#config'
import Cache from '#rCache'

export class viewScheduled extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'viewScheduled',
			aliases: [''],
			description:
				'View the scheduled game channels.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('viewscheduled')
					.setDescription(this.description),
			//    { idHints: [`1022940422974226432`] },
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
		const scheduled = await Cache().get(`scheduled`)
		if (!scheduled || _.isEmpty(scheduled)) {
			await interaction.reply({
				content: `There are no games currently scheduled to be created.`,
				ephemeral: true,
			})
			return
		}

		const createMatchStr = (game) =>
			`${game.away_team} *@* ${game.home_team}\n`

		// # Create Embed showing scheduled games via fields
		const emb = new MessageEmbed()
			.setTitle(`Scheduled Games`)
			.setColor('#e0ff19')
		_.forEach(scheduled, (game) => {
			emb.addField(game.day, createMatchStr(game))
		})
		await interaction.reply({
			embeds: [emb],
		})
	}
}
