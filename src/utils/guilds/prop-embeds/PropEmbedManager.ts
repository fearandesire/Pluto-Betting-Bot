import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Client,
	EmbedBuilder,
} from 'discord.js';
import { PropButtons } from '../../../lib/interfaces/props/prop-buttons.interface.js';
import {
	MarketKeyTranslations,
	type PropZod,
} from '../../api/common/interfaces/index.js';
import { DateManager } from '../../common/DateManager.js';
import TeamInfo from '../../common/TeamInfo.js';
import StringUtils from '../../common/string-utils.js';
import GuildUtils from '../GuildUtils.js';

interface AggregateDetailsParams {
	HTEAM_TRANSFORMED: string;
	AWTEAM_TRANSFORMED: string;
}

export default class PropEmbedManager {
	private client: Client;

	constructor(client: Client) {
		this.client = client;
	}

	async transformTeamName(teamName: string): Promise<string> {
		const shortName = new StringUtils().getShortName(teamName);
		const emoji = this.client.emojis.cache.find(
			(emoji) => emoji.name?.toLowerCase() === shortName.toLowerCase(),
		);
		return emoji ? `${emoji}` : shortName;
	}

	private aggregateDetails(
		prop: PropZod,
		{ HTEAM_TRANSFORMED, AWTEAM_TRANSFORMED }: AggregateDetailsParams,
	): {
		title: string;
		desc: string;
		fields: { name: string; value: string; inline: boolean }[];
		buttons: ButtonBuilder[];
	} {
		const marketKey = prop.market_key;
		const marketDescription = MarketKeyTranslations[marketKey] || marketKey;
		const standardizedMarketDescription =
			StringUtils.standardizeString(marketDescription);
		const humanReadableDate = new DateManager().humanReadable(
			prop.commence_time,
		);
		const matchString = `${HTEAM_TRANSFORMED} vs ${AWTEAM_TRANSFORMED}`;
		const createBtnString = (name: string) => name.replace(/\s+/g, '_');
		const HTEAM_BTN_STRING = createBtnString(HTEAM_TRANSFORMED);
		const AWTEAM_BTN_STRING = createBtnString(AWTEAM_TRANSFORMED);
		const ovrUnderStr = (amount: string) => `Over/Under **\`${amount}\`**`;
		const { point } = prop;
		const title = 'Accuracy Challenge';
		let desc = '';
		let fields: { name: string; value: string; inline: boolean }[] = [];
		let buttons: ButtonBuilder[] = [];

		if (prop.description) {
			// Player-based prop
			desc = `Will **${prop.description}** get over/under **\`${prop.point}\` ${marketDescription}**?`;
			fields = [
				{
					name: 'Match',
					value: matchString,
					inline: true,
				},
				{ name: 'Date', value: humanReadableDate, inline: true },
				{ name: 'Player', value: `**${prop.description}**`, inline: true },
				{
					name: 'Over/Under',
					value: `**\`${point}\`** ${standardizedMarketDescription}`,
					inline: true,
				},
			];
			buttons = [
				new ButtonBuilder()
					.setCustomId(`prop_${PropButtons.OVER}_${prop.id}`)
					.setLabel('Over ⬆️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`prop_${PropButtons.UNDER}_${prop.id}`)
					.setLabel('Under ⬇️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`prop_${PropButtons.CANCEL}_${prop.id}`)
					.setLabel('Cancel')
					.setStyle(ButtonStyle.Danger),
			];
		} else if (marketKey === 'h2h') {
			// Team-based prop (who will win)
			desc = `Who will win the match between **${HTEAM_TRANSFORMED}** and **${AWTEAM_TRANSFORMED}**?`;
			fields = [
				{
					name: 'Match',
					value: matchString,
					inline: true,
				},
				{ name: 'Date', value: humanReadableDate, inline: true },
			];
			buttons = [
				new ButtonBuilder()
					.setCustomId(`prop_${HTEAM_BTN_STRING}_${prop.id}`)
					.setLabel(`${HTEAM_TRANSFORMED}`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`prop_${AWTEAM_BTN_STRING}_${prop.id}`)
					.setLabel(`${AWTEAM_TRANSFORMED}`)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`prop_${PropButtons.CANCEL}_${prop.id}`)
					.setLabel('Cancel')
					.setStyle(ButtonStyle.Danger),
			];
		} else if (marketKey === 'totals' && !prop.description) {
			// Total score of the match (over/under)
			desc = `Will the total score of the match between **${HTEAM_TRANSFORMED}** and **${AWTEAM_TRANSFORMED}** be over/under **\`${prop.point}\`**?`;
			fields = [
				{
					name: 'Match',
					value: matchString,
					inline: true,
				},
				{ name: 'Date', value: humanReadableDate, inline: true },
				{
					name: 'Total Score',
					value: ovrUnderStr(prop.point),
					inline: true,
				},
			];
			buttons = [
				new ButtonBuilder()
					.setCustomId(`prop_${PropButtons.OVER}_${prop.id}`)
					.setLabel('Over ⬆️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`prop_${PropButtons.UNDER}_${prop.id}`)
					.setLabel('Under ⬇️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`prop_${PropButtons.CANCEL}_${prop.id}`)
					.setLabel('Cancel')
					.setStyle(ButtonStyle.Danger),
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
			const embeds = await Promise.all(
				props.map(async (prop) => {
					const HTEAM_TRANSFORMED = await this.transformTeamName(
						prop.home_team,
					);
					const AWTEAM_TRANSFORMED = await this.transformTeamName(
						prop.away_team,
					);
					const { title, desc, fields, buttons } = this.aggregateDetails(prop, {
						HTEAM_TRANSFORMED,
						AWTEAM_TRANSFORMED,
					});

					const teamColor = await TeamInfo.getTeamColor(prop.home_team);

					const embed = new EmbedBuilder()
						.setTitle(title)
						.setDescription(desc)
						.addFields(fields)
						.setColor(teamColor);

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

	async createSingleEmbed(
		prop: PropZod,
		{ HTEAM_TRANSFORMED, AWTEAM_TRANSFORMED }: AggregateDetailsParams,
	) {
		const { title, desc, fields, buttons } = this.aggregateDetails(prop, {
			HTEAM_TRANSFORMED,
			AWTEAM_TRANSFORMED,
		});

		const teamColor = await TeamInfo.getTeamColor(prop.home_team);

		const embed = new EmbedBuilder()
			.setTitle(title)
			.setDescription(desc)
			.addFields(fields)
			.setColor(teamColor);

		// Create buttons
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

		return { embed, row };
	}
}
