import { Command } from '@sapphire/framework'
import { SapDiscClient } from '#main'
import isInGuild from '../../utils/isInGuild.js'

export class deleteSlashCmd extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'deleteSlashCmd',
			aliases: [''],
			description:
				'Remove a registered slash command',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName('deleteslash')
				.setDescription(this.description)
				.setDMPermission(false)
				.addStringOption((option) =>
					option //
						.setName(`name`)
						.setDescription(
							`Name of the slash command to delete`,
						)
						.setRequired(true),
				),
		)
	}

	async chatInputRun(interaction) {
		await isInGuild(interaction)
		const commandName =
			interaction.options.getString(`name`)
		const registeredCmds =
			await SapDiscClient.application.commands.fetch()
		const command = registeredCmds.find(
			(cmd) =>
				cmd.name.toLowerCase() ===
				commandName.toLowerCase(),
		)
		if (command) {
			await SapDiscClient.application.commands.delete(
				command.id,
			)
			interaction.reply({
				content: `Deleted Slash command \`${commandName}\``,
			})
		} else {
			interaction.reply({
				content: `Command "${commandName}" not found.`,
			})
		}
	}
}
