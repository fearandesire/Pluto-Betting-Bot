import { helpfooter } from '@pluto-config';
import { type CommandInteraction, EmbedBuilder } from 'discord.js';
import embedColors from '../../../lib/colorsConfig.js';

export default class EmbedsSuccess {
	private static readonly embedColors = embedColors;
	private static readonly helpfooter = helpfooter;

	static async sv1(
		interaction: CommandInteraction,
		title: string,
		description: string,
	) {
		return new EmbedBuilder()
			.setTitle(title)
			.setDescription(description)
			.setColor(EmbedsSuccess.embedColors.success)
			.setFooter({ text: await EmbedsSuccess.helpfooter() })
			.setThumbnail(interaction.user.displayAvatarURL());
	}
}
