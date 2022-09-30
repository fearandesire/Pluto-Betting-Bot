import { Command } from '@sapphire/framework'
import { giveBalance } from '#utilCurrency/giveBalance'

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
					.setDescription(this.description)
					.addMentionableOption((option) =>
						option //
							.setName('user')
							.setDescription('The user to add money to')
							.setRequired(true),
					)
					.addIntegerOption((option) =>
						option //
							.setName('amount')
							.setDescription('The amount of money to add')
							.setRequired(true),
					),
			{ idHints: [`1023308312831328426`] },
		)
	}
	async chatInputRun(interaction) {
		var userid = interaction.user.id
		var target = interaction.options.getMentionable('user').user.id
		var amount = interaction.options.getInteger('amount')
		if (amount < 1) {
			interaction.reply({
				content: 'Please provide a valid amount.',
				ephemeral: true,
			})
			return
		} else {
			await giveBalance(interaction, target, amount)
			return
		}
	}
}
