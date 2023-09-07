import { Command } from '@sapphire/framework'
import { checkbalance } from '#utilValidate/checkbalance'
import { validateUser } from '#utilValidate/validateExistingUser'
import { isPreSzn } from '#config'

export class balanceSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'balanceSlash',
			aliases: [''],
			description: 'View the balance of a user',
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
		if (!target) {
			const isRegistered = await validateUser(
				interaction,
				userid,
			)
			if (!isRegistered) return
			await checkbalance(userid, interaction)
			return
		}
		if (target) {
			await checkbalance(userid, interaction, target)
		}
	}
}
