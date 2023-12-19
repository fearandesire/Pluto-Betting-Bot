import { Command } from '@sapphire/framework'
import { validateUser } from '#utilValidate/validateExistingUser'
import { isPreSzn } from '#config'
import fetchUsersBets from '../utils/bot_res/betOps/fetchUsersBets.js'

export class myBetsSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'myBetsSlash',
			aliases: [''],
			description:
				'🪙 View your currently active bets',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('mybets')
					.setDescription(this.description)
					.setDMPermission(false),
			{ idHints: [`1023323729540952075`] },
		)
	}

	async chatInputRun(interaction) {
		if (isPreSzn()) {
			return interaction.reply({
				content: `This is unavailable in the preseason.`,
				ephemeral: true,
			})
		}
		const userid = interaction.user.id
		const interactionEph = true
		const isRegistered = await validateUser(
			interaction,
			userid,
		)
		if (!isRegistered) return
		await fetchUsersBets(
			interaction,
			userid,
			interactionEph,
		)
	}
}
