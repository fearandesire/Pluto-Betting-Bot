import { Command } from '@sapphire/framework'
import { giveBalance } from '#utilCurrency/giveBalance'
import { validateUser } from '#utilValidate/validateExistingUser'

export class addMoneySlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'addMoneySlash',
			aliases: [''],
			description: 'Add money to a users balance.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('addmoney')
					.setDMPermission(false)
					.setDescription(this.description)
					.addMentionableOption((option) =>
						option //
							.setName('user')
							.setDescription(
								'The user to add money to',
							)
							.setRequired(true),
					)
					.addIntegerOption((option) =>
						option //
							.setName('amount')
							.setDescription(
								'The amount of money to add',
							)
							.setRequired(true),
					),
			{ idHints: [`1023308312831328426`] },
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
		const target =
			interaction.options.getMentionable('user').user
				.id
		const amount =
			interaction.options.getInteger('amount')
		if (amount < 1) {
			interaction.reply({
				content: 'Please provide a valid amount.',
				ephemeral: true,
			})
		} else {
			const isRegistered = await validateUser(
				interaction,
				target,
			)
			if (!isRegistered) return
			await giveBalance(interaction, target, amount)
		}
	}
}
