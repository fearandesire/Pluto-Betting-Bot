import { Command } from '@sapphire/framework'
import { checkCompleted } from '../../utils/api/checkCompleted.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const cron = require('cronitor')(`f9f7339479104e79bf2b52eb9c2242bf`)
cron.wraps(require('node-cron'))
const compGameMonitor = new cron.Monitor('Completed Game Monitor')

export class completedCheckSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'completedCheckSlash',
			aliases: [''],
			description: 'Request API to check for completed games.',
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
		var userid = interaction.user.id
		console.log(`User ${userid} requested to check for completed games.`)
		compGameMonitor.ping({
			state: 'run',
			message: `${userid} requested to check for completed games.`,
		})
		await checkCompleted(compGameMonitor)
	}
}
