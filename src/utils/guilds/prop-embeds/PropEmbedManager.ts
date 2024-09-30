import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	type Client,
} from 'discord.js';
import GuildUtils from '../GuildUtils.js';
import {
	MarketKeyTranslations,
	type PropZod,
} from '../../api/common/interfaces/index.js';
import { formatDiscordTimestamp } from '../../timestampUtils.js';
import StringUtils from '../../common/string-utils.js';
import { resolveTeam } from 'resolve-team';
import TeamInfo from '../../common/TeamInfo.js';
import { PropButtons } from '../../../lib/interfaces/props/prop-buttons.interface.js';

export default class PropEmbedManager {
	private client: Client;

	constructor(client: Client) {
		this.client = client;
	}

	private async transformTeamName(teamName: string): Promise<string> {
		const shortName = new StringUtils().getShortName(teamName);
		const emoji = this.client.emojis.cache.find(
			(emoji) => emoji.name?.toLowerCase() === shortName.toLowerCase(),
		);
		return emoji ? `${emoji}` : teamName;
	}

	private getEmbedDetails(prop: PropZod): {
		title: string;
		desc: string;
		fields: { name: string; value: string; inline: boolean }[];
		buttons: ButtonBuilder[];
	} {
		const marketKey = prop.market_key;
		const marketDescription = MarketKeyTranslations[marketKey] || marketKey;
		const standardizedMarketDescription =
			StringUtils.standardizeString(marketDescription);

		const title = 'Accuracy Challenge';
		let desc = '';
		let fields: { name: string; value: string; inline: boolean }[] = [];
		let buttons: ButtonBuilder[] = [];

		if (prop.description) {
			// Player-based prop
			desc = `Will **${prop.description}** get over/under **\`${prop.point}\` ${marketDescription}**?`;
			fields = [
				{ name: 'Player', value: `**${prop.description}**`, inline: true },
				{
					name: 'Over/Under',
					value: `**\`${prop.point}\`** ${standardizedMarketDescription}`,
					inline: true,
				},
			];
			buttons = [
				new ButtonBuilder()
					.setCustomId(`${PropButtons.OVER}_${prop.id}`)
					.setLabel('Over ⬆️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`${PropButtons.UNDER}_${prop.id}`)
					.setLabel('Under ⬇️')
					.setStyle(ButtonStyle.Primary),
			];
		} else if (marketKey === 'h2h') {
			// Team-based prop (who will win)
			desc = `Who will win the match between **${prop.home_team}** and **${prop.away_team}**?`;
			fields = [
				{
					name: 'Match',
					value: `${prop.home_team} vs ${prop.away_team}`,
					inline: true,
				},
			];
			buttons = [
				new ButtonBuilder()
					.setCustomId(`${prop.home_team}_${prop.id}`)
					.setLabel(`${prop.home_team} 🏠`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`${prop.away_team}_${prop.id}`)
					.setLabel(`${prop.away_team} 🛫`)
					.setStyle(ButtonStyle.Primary),
			];
		} else if (marketKey === 'totals' && !prop.description) {
			// Total score of the match (over/under)
			desc = `Will the total score of the match between **${prop.home_team}** and **${prop.away_team}** be over/under **\`${prop.point}\`**?`;
			fields = [
				{
					name: 'Match',
					value: `${prop.home_team} vs ${prop.away_team}`,
					inline: true,
				},
				{
					name: 'Total Score',
					value: `Over/Under **\`${prop.point}\`**`,
					inline: true,
				},
			];
			buttons = [
				new ButtonBuilder()
					.setCustomId(`${PropButtons.OVER}_${prop.id}`)
					.setLabel('Over ⬆️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`${PropButtons.UNDER}_${prop.id}`)
					.setLabel('Under ⬇️')
					.setStyle(ButtonStyle.Primary),
			];
		} else {
			// Unsupported markets
			return;
		}

		return { title, desc, fields, buttons };
	}

	async createEmbeds(
		props: PropZod[],
		guildChannels: { guild_id: string; channel_id: string }[],
	) {
		for (const { guild_id, channel_id } of guildChannels) {
			// Create an embed for each prop
			const embeds = await Promise.all(
				props.map(async (prop) => {
					const { title, desc, fields, buttons } = this.getEmbedDetails(prop);
					const homeTeamWithEmoji = await this.transformTeamName(
						prop.home_team,
					);
					const awayTeamWithEmoji = await this.transformTeamName(
						prop.away_team,
					);
					const teamColor = TeamInfo.getTeamColor(prop.home_team);

					const embed = new EmbedBuilder()
						.setTitle(title)
						.setDescription(desc)
						.addFields(fields)
						.setColor(teamColor)
						.setTimestamp();

					// Update the 'Match' field with emoji-enhanced team names
					const matchFieldIndex = fields.findIndex(
						(field) => field.name === 'Match',
					);
					if (matchFieldIndex !== -1) {
						embed.spliceFields(matchFieldIndex, 1, {
							name: 'Match',
							value: `${homeTeamWithEmoji} vs ${awayTeamWithEmoji}`,
							inline: true,
						});
					}

					// Create buttons
					const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
						buttons,
					);

					return { embed, row };
				}),
			);
			const guildUtils = new GuildUtils();
			const guild = await guildUtils.getGuild(guild_id);
			if (!guild) {
				console.error(`[PropEmbedManager] Guild not found: ${guild_id}`);
				continue;
			}
			const channel = await guild.channels.fetch(channel_id);
			if (channel?.isTextBased()) {
				for (const { embed, row } of embeds) {
					await channel.send({ embeds: [embed], components: [row] });
				}
			}
		}
	}
}
