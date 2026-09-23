import { helpfooter } from '@pluto-config'
import type { CommandInteraction } from 'discord.js'
import { successEmbed } from '../../../lib/discord/builders/account.js'

export default class EmbedsSuccess {
	private static readonly helpfooter = helpfooter

	static async sv1(
		interaction: CommandInteraction,
		title: string,
		description: string,
	) {
		return successEmbed({
			title,
			description,
			footer: await EmbedsSuccess.helpfooter(),
			thumbnail: interaction.user.displayAvatarURL(),
		})
	}
}
