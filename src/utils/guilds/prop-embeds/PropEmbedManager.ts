import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Client,
	EmbedBuilder,
	type Emoji,
	type GuildEmoji,
} from 'discord.js';
import _ from 'lodash';
import { PropButtons } from '../../../lib/interfaces/props/prop-buttons.interface.js';
import {
	MarketKeyTranslations,
	type PropZod,
} from '../../api/common/interfaces/index.js';
import { DateManager } from '../../common/DateManager.js';
import TeamInfo from '../../common/TeamInfo.js';
import StringUtils from '../../common/string-utils.js';
import { logger } from '../../logging/WinstonLogger.js';
import GuildUtils from '../GuildUtils.js';

interface AggregateDetailsParams {
	home: {
		fullName: string;
		transformed: GuildEmoji | Emoji | string;
		shortName: string;
	};
	away: {
		fullName: string;
		transformed: GuildEmoji | Emoji | string;
		shortName: string;
	};
}

export default class PropEmbedManager {
	private client: Client;

	constructor(client: Client) {
		this.client = client;
	}

	/**
	 * Convert a team name to emoji
	 * Fallback to the short name if no emoji is found
	 */
	async transformTeamName(
		teamName: string,
	): Promise<GuildEmoji | Emoji | string> {
		const shortName = new StringUtils().getShortName(teamName);
		const emoji = this.client.emojis.cache.find(
			(emoji) => emoji.name?.toLowerCase() === shortName.toLowerCase(),
		);
		return emoji ? emoji : shortName;
	}

	private aggregateDetails(
		prop: PropZod,
		{ home, away }: AggregateDetailsParams,
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
		const humanReadableDate = new DateManager().toDiscordUnix(
			prop.commence_time,
		);
		const matchString = `${home.transformed} vs ${away.transformed}`;
		// Strip spaces and replace with underscores for a uniform button ID
		const createBtnString = (name: string) => name.replace(/\s+/g, '_');
		const homeBtnString = createBtnString(home.fullName);
		const awayBtnString = createBtnString(away.fullName);
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
				{
					name: 'Over/Under',
					value: `**\`${point}\`** ${standardizedMarketDescription}`,
					inline: true,
				},
				{ name: 'Player', value: `**${prop.description}**`, inline: true },
				{ name: 'Date', value: humanReadableDate, inline: true },
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
			desc = `Who will win the match between **${home.transformed}** and **${away.transformed}**?`;
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
					.setCustomId(`prop_${homeBtnString}_${prop.id}`)
					.setLabel(home.shortName)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`prop_${awayBtnString}_${prop.id}`)
					.setLabel(away.shortName)
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(`prop_${PropButtons.CANCEL}_${prop.id}`)
					.setLabel('Cancel')
					.setStyle(ButtonStyle.Danger),
			];
			// Add team emojis if they are available
			if (typeof home.transformed !== 'string') {
				buttons[0].setEmoji(home.transformed.id);
			}
			if (typeof away.transformed !== 'string') {
				buttons[1].setEmoji(away.transformed.id);
			}
		} else if (marketKey === 'totals' && !prop.description) {
			desc = `Will the total score between **${home.transformed}** *vs.* **${away.transformed}** be over/under **\`${prop.point}\`**?`;
			fields = [
				{
					name: 'Match',
					value: matchString,
					inline: true,
				},
				{
					name: 'Total Score',
					value: ovrUnderStr(prop.point),
					inline: true,
				},
				{ name: 'Date', value: humanReadableDate, inline: true },
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
		guildChannels: { guild_id: string; channel_id: string; sport: string }[],
	) {
		let totalEmbedsCreated = 0;

		await logger.info('Starting prop embed creation process', {
			totalProps: props.length,
			totalGuildChannels: guildChannels.length,
			source: this.createEmbeds.name,
		});

		// Group props by sport
		const propsBySport = _.groupBy(props, 'sport_title');
		const guildsBySport = _.groupBy(guildChannels, 'sport');

		await logger.info('Iterating through props & guilds by sport', {
			propsBySportLength: Object.keys(propsBySport).length,
			guildsBySportLength: Object.keys(guildsBySport).length,
			propsBySport,
			guildsBySport,
			source: this.createEmbeds.name,
		});

		// For each sport that has props
		for (const sport in propsBySport) {
			const sportGuilds = guildsBySport[sport] || [];
			const sportProps = propsBySport[sport] || [];

			await logger.info(`Processing props for sport: ${sport}`, {
				sport,
				propsCount: sportProps.length,
				guildsCount: sportGuilds.length,
				source: this.createEmbeds.name,
			});

			// ? Skip empty entries
			if (!sportProps.length || !sportGuilds.length) {
				await logger.info('Skipping sport due to no props or guilds', {
					sport,
					sportPropsLength: sportProps.length,
					sportGuildsLength: sportGuilds.length,
					source: this.createEmbeds.name,
				});
				continue;
			}

			// For each guild that follows this sport
			for (const { guild_id, channel_id } of sportGuilds) {
				await logger.info('Processing guild', {
					guild_id,
					channel_id,
					sport,
					source: this.createEmbeds.name,
				});

				const guildUtils = new GuildUtils();
				const guild = await guildUtils.getGuild(guild_id);

				if (!guild) {
					await logger.info('Skipping guild due to not found', {
						guild_id,
						source: this.createEmbeds.name,
					});
					continue;
				}

				const channel = await guild.channels.fetch(channel_id);
				if (!channel?.isTextBased()) {
					await logger.info(
						'Skipping channel due to not being text based',
						{
							channel_id,
							source: this.createEmbeds.name,
						},
					);
					continue;
				}

				// Create all embeds for this sport's props
				const embeds = await Promise.all(
					sportProps.map(async (prop) => {
						await logger.info('Creating embed for prop', {
							prop_id: prop.id,
							home_team: prop.home_team,
							away_team: prop.away_team,
							market_key: prop.market_key,
							source: this.createEmbeds.name,
						});

						const HTEAM_TRANSFORMED = await this.transformTeamName(
							prop.home_team,
						);
						const AWTEAM_TRANSFORMED = await this.transformTeamName(
							prop.away_team,
						);
						const HTEAM_SHORT_NAME = new StringUtils().getShortName(
							prop.home_team,
						);
						const AWTEAM_SHORT_NAME = new StringUtils().getShortName(
							prop.away_team,
						);

						const { title, desc, fields, buttons } = this.aggregateDetails(
							prop,
							{
								home: {
									fullName: prop.home_team,
									transformed: HTEAM_TRANSFORMED,
									shortName: HTEAM_SHORT_NAME,
								},
								away: {
									fullName: prop.away_team,
									transformed: AWTEAM_TRANSFORMED,
									shortName: AWTEAM_SHORT_NAME,
								},
							},
						);

						const teamColor = await TeamInfo.getTeamColor(prop.home_team);

						const embed = new EmbedBuilder()
							.setTitle(title)
							.setDescription(desc)
							.addFields(fields)
							.setColor(teamColor);

						const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
							buttons,
						);

						return { embed, row };
					}),
				);

				await logger.info('Created embeds batch for guild', {
					guild_id,
					channel_id,
					embedsCount: embeds.length,
					source: this.createEmbeds.name,
				});

				// Send all embeds to the channel
				for (const { embed, row } of embeds) {
					try {
						await channel.send({ embeds: [embed], components: [row] });
						totalEmbedsCreated++;

						await logger.info('Successfully sent embed to channel', {
							guild_id,
							channel_id,
							currentTotal: totalEmbedsCreated,
							source: this.createEmbeds.name,
						});
					} catch (error) {
						await logger.error('Failed to send embed to channel', {
							guild_id,
							channel_id,
							error: error instanceof Error ? error.message : 'Unknown error',
							source: this.createEmbeds.name,
						});
					}
				}
			}
		}

		await logger.info('Completed prop embed creation process', {
			totalEmbedsCreated,
			totalProps: props.length,
			totalGuildChannels: guildChannels.length,
			source: this.createEmbeds.name,
		});
	}

	async createSingleEmbed(
		prop: PropZod,
		{ home, away }: AggregateDetailsParams,
	) {
		await logger.info('Creating single embed', {
			prop_id: prop.id,
			home_team: prop.home_team,
			away_team: prop.away_team,
			market_key: prop.market_key,
			source: this.createSingleEmbed.name,
		});

		const { title, desc, fields, buttons } = this.aggregateDetails(prop, {
			home,
			away,
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
