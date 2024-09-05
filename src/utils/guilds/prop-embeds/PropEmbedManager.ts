import type { Prop } from '@khronos-index'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from 'discord.js'
import GuildUtils from '../GuildUtils.js'
import { MarketKeyTranslations } from '../../api/common/interfaces'
import { formatDiscordTimestamp } from '../../timestampUtils.js'

export default class PropEmbedManager {
	async createEmbeds(
		props: Prop[],
		guildChannels: { guild_id: string; prop_channel_id: string }[],
	) {
		for (const { guild_id, prop_channel_id } of guildChannels) {
			console.log(
				`Creating embeds for guild: ${guild_id} in channel: ${prop_channel_id} with props:`,
				props,
			)

			// Create an embed for each prop
			const embeds = props.map((prop) => {
				const marketKey = prop.market_key // Assuming prop has a market_key property
				const marketDescription =
					// @ts-ignore - Not supporting every market. Will need to narrow this down.
					MarketKeyTranslations[marketKey] || marketKey // Use the enum for translation
				const descriptionStr = `Will ${prop?.description} get over/under ${prop.point} ${marketDescription}?`

				const embedDetails = {
					title: `Accuracy Challenge`,
					desc: descriptionStr,
				}

				const embed = new EmbedBuilder()
					.setTitle(embedDetails.title)
					.setDescription(embedDetails.desc)
					.addFields(
						{
							name: 'Match',
							value: `${prop.home_team} vs ${prop.away_team}`,
							inline: true,
						},
						{
							name: 'Date',
							value: formatDiscordTimestamp(prop.commence_time),
							inline: true,
						},
					)
					.setFooter({ text: `ID: ${prop.id}` })
					.setColor('#0099ff')
					.setTimestamp()
				// Create buttons
				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId(`prop_bet_over_${prop.id}`)
						.setLabel(`Over`)
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId(`prop_bet_under_${prop.id}`)
						.setLabel(`Under`)
						.setStyle(ButtonStyle.Primary),
				)
				return { embed, row }
			})
			const guildUtils = new GuildUtils()
			const guild = await guildUtils.getGuild(guild_id)
			if (!guild) {
				console.error(`[PropEmbedManager] Guild not found: ${guild_id}`)
				continue
			}
			const channel = await guild.channels.fetch(prop_channel_id)
			if (channel && channel.isTextBased()) {
				for (const { embed, row } of embeds) {
					await channel.send({ embeds: [embed], components: [row] })
				}
			}
		}
	}
}