import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

/**
 * @description - Utility class for creating & managing pagination buttons for Discord Embeds
 */
export default class Pagination {
	/**
	 * Creates buttons to navigate and assist with pagination of a Discord Embed
	 * @param currentPage - The current page number
	 * @param totalPages - The total number of pages
	 * @returns An array of ActionRowBuilder objects containing the buttons
	 */

	public createPaginationButtons(
		currentPage: number,
		totalPages: number,
	): ActionRowBuilder<ButtonBuilder>[] {
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('first')
				.setLabel('First')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === 1),
			new ButtonBuilder()
				.setCustomId('previous')
				.setLabel('Previous')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === 1),
			new ButtonBuilder()
				.setCustomId('next')
				.setLabel('Next')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === totalPages),
			new ButtonBuilder()
				.setCustomId('last')
				.setLabel('Last')
				.setStyle(ButtonStyle.Primary)
				.setDisabled(currentPage === totalPages),
		)

		return [row]
	}
}
