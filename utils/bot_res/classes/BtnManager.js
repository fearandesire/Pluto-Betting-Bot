import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from 'discord.js'
import { helpfooter } from '@pluto-core-config'
import embedColors from '../../../lib/colorsConfig.js'
import { sendErrorEmbed } from '../embeds/embedReply.js'

export default class BtnManager {
	constructor(interaction) {
		this.interaction = interaction
		this.buttonTimer = 120000 // 2 minutes
		// Initialize buttons
		this.confirmButton = new ButtonBuilder()
			.setCustomId('confirm')
			.setLabel('Confirm')
			.setStyle(ButtonStyle.Success)

		this.cancelButton = new ButtonBuilder()
			.setCustomId('cancel')
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Danger)
	}

	async createButtons(content) {
		const row = new ActionRowBuilder().addComponents(
			this.confirmButton,
			this.cancelButton,
		)

		await this.interaction.editReply({
			content,
			components: [row],
		})
	}

	async waitForConfirmation(
		successEmbedOptions,
		cancelEmbedOptions,
	) {
		const filter = (i) =>
			i.user.id === this.interaction.user.id

		try {
			const response =
				await this.interaction.channel?.awaitMessageComponent(
					{ filter, time: this.buttonTimer },
				)

			if (response?.customId === 'confirm') {
				const confirmEmbed = new EmbedBuilder()
				confirmEmbed.setTitle(
					successEmbedOptions.title,
				)
				confirmEmbed.setDescription(
					successEmbedOptions.description,
				)
				confirmEmbed.setThumbnail(
					successEmbedOptions.thumbnail,
				)
				confirmEmbed.setColor(embedColors.success)
				confirmEmbed.setFooter({ text: helpfooter })
				await response.update({
					content: ``,
					embeds: [confirmEmbed],
					components: [],
				})
				return true
			}
			if (response?.customId === 'cancel') {
				const cancelEmbed = new EmbedBuilder()
				cancelEmbed.setDescription(
					cancelEmbedOptions.description,
				)
				cancelEmbed.setColor(embedColors.error)
				cancelEmbed.setFooter({ text: helpfooter })
				await response?.update({
					content: ``,
					embeds: [cancelEmbed],
					components: [],
				})
				return false
			}
		} catch (error) {
			// Check if collector ended due to timeout
			if (error.message.includes('time')) {
				await sendErrorEmbed(
					this.interaction,
					`Your pending bet has timed out due to a lack of response in time.\nYou will be refunded -- please try again.`,
					1,
				)
			}
			console.error(error)
			return false
		}
	}
}
