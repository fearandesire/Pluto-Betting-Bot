import { Command } from '@sapphire/framework'
import { processClaim } from '#utilBetOps/processClaim'
import { validateUser } from '#utilValidate/validateExistingUser'

export class dailyClaimSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'dailyClaimSlash',
			aliases: [''],
			description:
				'💲 Claim $100 dollars every 24 hours.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('dailyclaim')
					.setDescription(this.description),
			{ idHints: [`1022940422974226432`] },
		)
	}

	async chatInputRun(interaction) {
		const userid = interaction.user.id
		const isRegistered = await validateUser(
			interaction,
			userid,
		)
		if (!isRegistered) return
		await processClaim(userid, interaction)
	}
}
