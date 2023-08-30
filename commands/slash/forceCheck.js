import { Command } from '@sapphire/framework'
import { handleBetMatchups } from '#api/handleBetMatchups'
import PlutoLogger from '#PlutoLogger'

export class forceCheck extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'forceCheck',
			aliases: [''],
			description:
				'Request API to check for completed games.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('forcecheck')
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
		const userid = interaction.user.id
		await interaction.reply({
			content: `Requesting API to check for completed games.`,
			ephemeral: true,
		})
		await PlutoLogger.log({
			title: `Cmd Log`,
			description: `${
				interaction.user?.username || userid
			} requested to check for completed games.`,
		})
		await handleBetMatchups()
	}
}
