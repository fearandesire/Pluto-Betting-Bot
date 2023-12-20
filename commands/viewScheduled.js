import { Command } from '@sapphire/framework'
import { _, QuickError } from '#config'
import { guildImgURL } from '#embed'
import { SPORT } from '#serverConf'
import Cache from '#rCache'
import PlutoLogger from '#PlutoLogger'
import parseScheduled from '../utils/bot_res/parseScheduled.js'

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
					.setDescription(this.description)
					.setDMPermission(false),
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
		const scheduled = await Cache().get(
			`scheduled_games`,
		)
		if (!scheduled || _.isEmpty(scheduled)) {
			await interaction.reply({
				content: `There are no games currently scheduled to be created.`,
				ephemeral: true,
			})
			return
		}
		const thumbnail = await guildImgURL(
			interaction.client,
		)
		await parseScheduled(scheduled, { thumbnail }).then(
			async (res) => {
				if (res === false) {
					await QuickError(
						interaction,
						`Unable to view scheduled games - It appears something is setup wrong with the app!`,
					)
					await PlutoLogger.log({
						title: `Game Scheduling Logs`,
						description: `Error: ${SPORT} is not supported.\nCheck app configuration\nCmd: ${interaction.commandName} | Called By User: ${interaction.user.tag}`,
					})
				} else {
					await interaction.reply({
						embeds: [res],
					})
				}
			},
		)
	}
}
