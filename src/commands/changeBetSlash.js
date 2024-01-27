import { Command } from '@sapphire/framework'
import { modifyAmount } from '@pluto-betOps/modifyAmount.js'
import {
	PROFILES,
	BETSLIPS,
	CURRENCY,
	LIVEBETS,
} from '@pluto-server-config'
import { validateUser } from '@pluto-validate/validateExistingUser.js'
import { verifyBetAuthor } from '@pluto-validate/verifyBetAuthor.js'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import { fetchBalance } from '@pluto-currency/fetchBalance.js'
import { QuickError } from '@pluto-embed-reply'
import BetManager from '../utils/bot_res/classes/BetManager.js'

export class changeBetSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'changeBetSlash',
			aliases: [''],
			description:
				'🔀 Change the amount of money you put on a specified bet',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('changebet')
					.setDescription(this.description)
					.setDMPermission(false)
					.addIntegerOption((option) =>
						option //
							.setName('betid')
							.setDescription(
								'The ID of the bet you are wanting to change. Retrieve your bet IDs with the /mybets command.',
							)
							.setRequired(true),
					)
					.addIntegerOption((option) =>
						option //
							.setName('amount')
							.setDescription(
								'The amount of money you are changing your bet to.',
							)
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
		const userid = interaction.user.id
		const betId =
			interaction.options.getInteger('betid')
		const amount =
			interaction.options.getInteger('amount')
		if (amount < 1) {
			interaction.reply({
				content: `You cannot bet less than $1.`,
				ephemeral: true,
			})
			return
		}
		const isRegistered = await validateUser(
			interaction,
			userid,
		)
		if (!isRegistered) return

		// Check user has enough for change
		const balance = await fetchBalance(
			interaction,
			userid,
		)
		if (balance < amount) {
			await QuickError(
				interaction,
				`You do not have enough money to make this change.\nCurrent Balance: **\`$${balance}\`**`,
				true,
			)
			return
		}
		const interactionEph = true // ? client-side / silent reply
		const betVerificaiton = await verifyBetAuthor(
			interaction,
			userid,
			betId,
			interactionEph,
		) // ? Verify the bet belongs to the user
		if (betVerificaiton === false) {
			interaction.reply({
				content: `**You do not have a bet with that ID.**`,
				ephemeral: true,
			})
			return
		}
		const matchup = await new BetManager({
			PROFILES,
			BETSLIPS,
			CURRENCY,
			LIVEBETS,
		}).matchupIdViaBetId(betId)
		const matchupApiId = matchup.id
		const validGameStatus =
			await MatchupManager.gameIsLive(matchupApiId)
		if (!validGameStatus) {
			await QuickError(
				interaction,
				`You are unable to change this bet because the game has already started!`,
				true,
			)
			return
		}
		await modifyAmount(
			interaction,
			userid,
			betId,
			amount,
			interactionEph,
		)
	}
}
