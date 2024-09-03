import type { Prop } from '@khronos-index'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from 'discord.js'
import GuildUtils from '../GuildUtils.js'

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

			const embedDetails = {
				title: `Accuracy Challenge`,
			}

			// Create an embed for each prop
			const embeds = props.map((prop) => {
				const embed = new EmbedBuilder()
					.setTitle(embedDetails.title)
					.setDescription(
						`Will ${prop?.description} get over/under ${prop.point} <market>?`,
					)
					.addFields(
						{
							name: 'Home Team',
							value: prop.home_team,
							inline: true,
						},
						{
							name: 'Away Team',
							value: prop.away_team,
							inline: true,
						},
						// Bar for player to get over/under [TODO: Translate into what the requirement is based on the market key]
						{
							name: 'Points',
							value: `${prop.point}`,
							inline: true,
						},
					)
					.setFooter({ text: `ID: ${prop.id}` })
					.setColor('#0099ff')
					.setTimestamp()

				// Create buttons for over/under
				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId(`prop_bet_over_${prop.id}`)
						.setLabel(`Over ${prop.point}`)
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId(`prop_bet_under_${prop.id}`)
						.setLabel(`Under ${prop.point}`)
						.setStyle(ButtonStyle.Primary),
				)

				return { embed, row }
			})

			const guildUtils = new GuildUtils()
			const guild = await guildUtils.getGuild(guild_id)

			if (!guild) {
				console.error(`Guild not found: ${guild_id}`)
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
