import {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	EmbedBuilder,
} from 'discord.js'
import { helpfooter } from '#config'
import embedColors from '../../../lib/colorsConfig.js'

export default class SelectMenuManager {
	constructor(interaction) {
		this.interaction = interaction
	}

	async createSelectMenu(
		options,
		placeholder = 'Select an option',
	) {
		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('select-menu')
			.setPlaceholder(placeholder)

		// Add options to the select menu
		options.forEach((option) => {
			selectMenu.addOptions({
				label: option.label,
				value: option.value,
				description: option.description,
			})
		})

		const row = new ActionRowBuilder().addComponents(
			selectMenu,
		)

		await this.interaction.editReply({
			content: 'Please make a selection:',
			components: [row],
		})
	}

	async waitForSelection(successEmbedOptions = null) {
		const filter = (i) =>
			i.user.id === this.interaction.user.id &&
			i.customId === 'select-menu'

		try {
			const response =
				await this.interaction.channel?.awaitMessageComponent(
					{ filter, time: 15000 },
				)

			const selectedOption = response.values[0]
			if (successEmbedOptions) {
				const successEmbed = new EmbedBuilder()
					.setTitle(successEmbedOptions.title)
					.setDescription(
						`You selected: ${selectedOption}`,
					)
					.setColor(embedColors.success)
					.setFooter({ text: helpfooter })

				await response.update({
					embeds: [successEmbed],
					components: [],
				})
			} else {
				await response.update({
					components: [],
					content: `Creating your betslip, plase wait.`,
				})
			}
			return selectedOption
		} catch (error) {
			return null
		}
	}
}
