import { Command } from '@sapphire/framework'
import { isPreSzn } from '@pluto-core-config'
import isInGuild from '../utils/isInGuild.js'
import { BetslipManager } from '../utils/api/requests/bets/BetslipsManager.js'

export class Bet extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'bet',
			aliases: [''],
			description:
				"💰 Place a bet on a matchup. Use the /odds command to view this week's Games!",
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName(this.name)
					.setDescription(this.description)
					.setDMPermission(false)
					.addStringOption((option) =>
						option //
							.setName('team')
							.setDescription(
								'The team you are placing your bet on',
							)
							.setRequired(true),
					)
					.addIntegerOption((option) =>
						option //
							.setName('amount')
							.setDescription(
								'💰 The amount of money you are betting',
							)
							.setRequired(true),
					),
			{ idHints: [`1022572274546651337`] },
		)
	}

	async chatInputRun(interaction) {
		await isInGuild(interaction)

		if (isPreSzn()) {
			return interaction.reply({
				content: `This is unavailable in the preseason.`,
				ephemeral: true,
			})
		}

		await interaction.deferReply({
			content: `Submitting your bet, one moment!`,
		})

		const userid = interaction.user.id
		try {
			return new BetslipManager(interaction.client).initialize(
				interaction,
				userid,
				interaction.options.getString('team'),
				interaction.options.getInteger('amount'),
				interaction.guildId,
			)
		} catch (err) {
			console.log(err)
		}
	}
}
