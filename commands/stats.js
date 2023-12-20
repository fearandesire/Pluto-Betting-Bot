import { Command } from '@sapphire/framework'
import { getBettingStats } from '@pluto-bettingStats'
import { QuickError } from '@pluto-core-config'
import PlutoLogger from '@pluto-logger'

export class Stats extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'stats',
			aliases: [''],
			description:
				'📊 View betting stats for yourself, or other people',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName('stats')
				.setDescription(this.description)
				.setDMPermission(false)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('everyone')
						.setDescription(
							'👀 View betting stats for everyone in the server.',
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('user')
						.setDescription(
							' View betting stats for a specific user.',
						)
						.addMentionableOption((option) =>
							option //
								.setName('user')
								.setDescription(
									`📘 Provide the @ of the user you want to view stats for.`,
								)
								.setRequired(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('yourself')
						.setDescription(
							'📈 View your personal betting stats.',
						),
				),
		)
	}

	async chatInputRun(interaction) {
		const userid = interaction.user.id
		await interaction.deferReply()
		const cmd = interaction.options.getSubcommand()
		const user =
			interaction.options.getMentionable('user')
		const targetId = user ? user?.id : userid
		if (cmd === 'all') {
			await getBettingStats({
				interaction,
				type: 'all',
			}).catch(async () => {
				await QuickError(
					interaction,
					`Unable to collect stats.`,
				)
				await PlutoLogger.log({
					id: 4,
					description: `An error occured when collecting stats.`,
				})
			})
		} else {
			const fetchedStats = await getBettingStats({
				interaction,
				type: 'individual',
				id: targetId,
			}).catch(async (err) => {
				const msg = `Unable to collect stats.`
				await QuickError(interaction, msg, true)
				await PlutoLogger.log({
					id: 4,
					description: `An error occured when collecting stats.\nError: ${err?.msg}`,
				})
			})
			if (fetchedStats === 204) {
				return QuickError(
					interaction,
					`You do not have enough bets to view stats of yourself.`,
					true,
				)
			}
		}
	}
}
