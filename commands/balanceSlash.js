import { Command } from '@sapphire/framework'
import { validateUser } from '@pluto-validate/validateExistingUser.js'
import { isPreSzn } from '@pluto-core-config'
import BalanceHandler from '../utils/bot_res/classes/BalanceManager.js'

export class balanceSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'balanceSlash',
			aliases: [''],
			description: '🏦 View the balance of a user',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('balance')
					.setDescription(this.description)
					.setDMPermission(false)
					.addMentionableOption((option) =>
						option //
							.setName('user')
							.setDescription(
								'OPTIONAL: User to view balance of | If left empty, will view your own balance',
							),
					),
			{ idHints: [`1022954913489223690`] },
		)
	}

	async chatInputRun(interaction) {
		if (isPreSzn()) {
			return interaction.reply({
				content: `This is unavailable in the preseason.`,
				ephemeral: true,
			})
		}
		const target =
			interaction.options.getMentionable('user')
		const userid = interaction.user.id
		const balanceManager = new BalanceHandler(
			interaction,
		)
		try {
			if (!target) {
				const isRegistered = await validateUser(
					interaction,
					userid,
				)
				if (!isRegistered) return
				await balanceManager.checkBalance(
					userid,
					target,
				)
				return
			}
			if (target) {
				await balanceManager.checkBalance(
					userid,
					target,
				)
			}
		} catch (e) {
			console.error(e)
		}
	}
}
