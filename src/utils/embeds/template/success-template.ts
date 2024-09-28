import embedColors from '../../../lib/colorsConfig.js';
import { CommandInteraction, EmbedBuilder } from 'discord.js';
import { helpfooter } from '@pluto-config';

export default class EmbedsSuccess {
	private readonly embedColors = embedColors;
	private readonly helpfooter = helpfooter;
	private interaction: CommandInteraction;
	constructor(interaction: CommandInteraction) {
		this.interaction = interaction;
		this.embedColors = embedColors;
		this.helpfooter = helpfooter;
	}
	/**
	 * Method to be re-used for success embeds where we need to show the user avatar as a thumbnail
	 */
	async sv1(title: string, description: string) {
		return new EmbedBuilder()
			.setTitle(title)
			.setDescription(description)
			.setColor(this.embedColors.success)
			.setFooter({ text: helpfooter() })
			.setThumbnail(this.interaction.user.displayAvatarURL());
	}
}
