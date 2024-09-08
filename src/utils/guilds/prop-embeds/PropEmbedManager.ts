import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	Client,
} from 'discord.js'
import GuildUtils from '../GuildUtils.js'
import { MarketKeyTranslations, type PropZod } from '@pluto-api-interfaces'
import { formatDiscordTimestamp } from '../../timestampUtils.js'
import StringUtils from '../../common/string-utils.js'
import { resolveTeam } from 'resolve-team'
import TeamInfo from '../../common/TeamInfo.js'

export default class PropEmbedManager {
	private client: Client

	constructor(client: Client) {
		this.client = client
	}

	private async transformTeamName(teamName: string): Promise<string> {
		const shortName = new StringUtils().getShortName(teamName)
		const emoji = this.client.emojis.cache.find(
			(emoji) => emoji.name?.toLowerCase() === shortName.toLowerCase(),
		)
		return emoji ? `${emoji} ${teamName}` : teamName
	}

	async createEmbeds(
		props: PropZod[],
		guildChannels: { guild_id: string; channel_id: string }[],
	) {
		for (const { guild_id, channel_id } of guildChannels) {
			// Create an embed for each prop
			const embeds = await Promise.all(
				props.map(async (prop) => {
					const marketKey = prop.market_key
					const marketDescription =
						// @ts-ignore - Not supporting every market. TODO: Will need to narrow this down.
						MarketKeyTranslations[marketKey] || marketKey

					const standardizedMarketDescription =
						StringUtils.standardizeString(marketDescription)
					const descriptionStr = `Will **${prop?.description}** get over/under **\`${prop.point}\` ${marketDescription}?**`

					const embedDetails = {
						title: `Accuracy Challenge`,
						desc: descriptionStr,
					}

					const homeTeamWithEmoji = await this.transformTeamName(
						prop.home_team,
					)
					const awayTeamWithEmoji = await this.transformTeamName(
						prop.away_team,
					)
					const teamColor = TeamInfo.getTeamColor(prop.home_team)

					const embed = new EmbedBuilder()
						.setTitle(embedDetails.title)
						.setDescription(embedDetails.desc)
						.addFields(
							{
								name: 'Player',
								value: `**${prop.description}**`,
								inline: true,
							},
							{
								name: 'Over/Under',
								value: `**\`${prop.point}\`** ${standardizedMarketDescription}`,
								inline: true,
							},
							{
								name: 'Match',
								value: `${homeTeamWithEmoji} vs ${awayTeamWithEmoji}`,
								inline: true,
							},
							{
								name: 'Date',
								value: formatDiscordTimestamp(
									prop.commence_time,
								),
								inline: true,
							},
						)
						.setColor(teamColor)
						.setTimestamp()
					// Create buttons
					const row =
						new ActionRowBuilder<ButtonBuilder>().addComponents(
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
				}),
			)
			const guildUtils = new GuildUtils()
			const guild = await guildUtils.getGuild(guild_id)
			if (!guild) {
				console.error(`[PropEmbedManager] Guild not found: ${guild_id}`)
				continue
			}
			const channel = await guild.channels.fetch(channel_id)
			if (channel && channel.isTextBased()) {
				for (const { embed, row } of embeds) {
					await channel.send({ embeds: [embed], components: [row] })
				}
			}
		}
	}
}
