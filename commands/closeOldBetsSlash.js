import { Command } from '@sapphire/framework'
import { Log } from '#config'
import { closeOldBets } from '../utils/db/betOps/closeBets/correctOldBets/closeOldBets.js'

export class closeOldBetsSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'closeOldBetsSlash',
			aliases: [''],
			description: 'Close outstanding bets.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('closeoldbets')
					.setDescription(this.description)
					.addStringOption((option) =>
						option //
							.setName('winning_team')
							.setDescription(
								'The winning team.',
							)
							.setRequired(true),
					)
					.addStringOption((option) =>
						option //
							.setName('losing_team')
							.setDescription(
								'The losing team.',
							)
							.setRequired(true),
					)
					.addStringOption((option) =>
						option //
							.setName('winning_team_odds')
							.setDescription(
								'The winning team odds.',
							)
							.setRequired(true),
					)
					.addStringOption((option) =>
						option //
							.setName('matchid')
							.setDescription('The match ID.')
							.setRequired(true),
					),
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
		await interaction.deferReply({ ephemeral: true })
		const userid = interaction.user.id
		const winTeam =
			interaction.options.getString('winning_team')
		const loseTeam =
			interaction.options.getString('losing_team')
		const winOdds = interaction.options.getString(
			'winning_team_odds',
		)
		const matchid =
			interaction.options.getString('matchid')
		Log.Green(
			`${userid} has queued all old bets to close.`,
		)
		const msg = interaction
		await closeOldBets(
			winTeam,
			loseTeam,
			winOdds,
			matchid,
		).then(async () => {
			await msg.followUp({
				content: `All old bets have been closed.`,
				ephemeral: true,
			})
		})
	}
}
