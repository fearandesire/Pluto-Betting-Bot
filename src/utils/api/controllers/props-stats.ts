import type {
	PropEmbedsIncoming,
	H2HPropStats,
	NonH2HPropStats,
	PropPredictionStats,
} from '../common/interfaces/schemas/prop.schema.js';
import { container } from '@sapphire/framework';
import { PropsPresentation } from '../services/props-presentation.service.js';
import ClientTools from '../../bot_res/ClientTools.js';
import type { EmbedData, Guild, TextBasedChannel } from 'discord.js';
import TeamInfo, { type GetTeamInfoResponse } from '../../common/TeamInfo.js';
import { bold, EmbedBuilder, underline } from 'discord.js';

/**
 * @summary Handles the logic for compiling and formatting prop embeds
 * @description The goal of the compilation of methods in this class is to achieve an object of formatted embeds data that are ready to send to the guilds.
 * The formatted embeds should follow something along the lines of:
 * Title: 'Accuracy Challenge Stats'
 * Description: '## away team vs home team'
 * Fields:
 * - Over: percentages.over
 * - Under: percentages.under
 *
 * If the market key is 'h2h', then the fields in 'percentages' will be the home and away team.
 * So we will anonymously handle it, regardless of what the field name is
 */

export default class PropsStats extends PropsPresentation {
	private clientTools: ClientTools;

	/**
	 * Orchestrates the logic to prepare the embeds for sending prop stats
	 */
	async compileEmbedData(data: PropEmbedsIncoming) {
		this.clientTools = new ClientTools(container);

		// Fetch Discord Guild information in parallel
		const guildsAndChannels = await Promise.all(
			data.guilds.map(async (guild) => {
				return {
					guild: await this.clientTools.resolveGuild(guild.guild_id),
					channel: await this.clientTools.resolveChannel(guild.channel_id),
				};
			}),
		);

		// Filter out any null guilds or channels (unresolved)
		const validGuildData = guildsAndChannels.filter(
			(entry): entry is NonNullable<typeof entry> =>
				entry.guild !== null && entry.channel !== null,
		);

		if (validGuildData.length === 0) {
			throw new Error('No valid guilds found for prop stats');
		}

		// Format the data for the prop embeds
		const formattedProps = await this.formatPropEmbedData(data.props);

		// Send the embeds to the guilds
		await this.sendPropStatEmbeds(formattedProps, validGuildData);
	}

	async formatFieldData(
		prop: PropPredictionStats,
		teamData: {
			away: GetTeamInfoResponse;
			home: GetTeamInfoResponse;
		},
	) {
		const isH2H = (
			prop: PropPredictionStats,
		): prop is PropPredictionStats & { stats: H2HPropStats } => {
			return prop.market_key === 'h2h';
		};

		if (isH2H(prop)) {
			const { home, away } = prop.stats.percentages;
			return [
				{
					name: teamData.away.combinedString,
					value: `${bold(`\`${away}%\``)}`,
					inline: true,
				},
				{
					name: teamData.home.combinedString,
					value: `${bold(`\`${home}%\``)}`,
					inline: true,
				},
			];
		}

		// At this point, prop.stats is NonH2HPropStats
		const { over, under } = prop.stats.percentages as {
			over: number;
			under: number;
		};

		return [
			{
				name: `${underline('Over')}`,
				value: `${bold(`\`${over}%\``)}`,
				inline: true,
			},
			{
				name: `${underline('Under')}`,
				value: `${bold(`\`${under}%\``)}`,
				inline: true,
			},
		];
	}

	async formatPropEmbedData(
		props: PropEmbedsIncoming['props'],
	): Promise<EmbedData[]> {
		return Promise.all(
			props.map(async (prop) => {
				const teamInfo = new TeamInfo();
				const awayTeamInfo = await teamInfo.getTeamInfo(prop.away_team);
				const homeTeamInfo = await teamInfo.getTeamInfo(prop.home_team);

				const title = 'Accuracy Challenge Stats';
				const description = `### ${awayTeamInfo.combinedString} vs ${homeTeamInfo.combinedString}\nThe game has started & predictions are locked 🔒!`;

				// Create fields based on market type
				// Create fields based on market type
				const fields = await this.formatFieldData(prop, {
					away: awayTeamInfo,
					home: homeTeamInfo,
				});

				return {
					title,
					description,
					fields,
					color: homeTeamInfo.color,
				};
			}),
		);
	}

	async sendPropStatEmbeds(
		embedData: EmbedData[],
		guildsAndChannels: { guild: Guild; channel: TextBasedChannel }[],
	) {
		// Create Embeds for each embedData
		const embeds = await Promise.all(
			embedData.map((data) => new EmbedBuilder(data)),
		);

		// Send the embeds to the guilds
		for (const { guild, channel } of guildsAndChannels) {
			await channel.send({ embeds });
		}
	}
}
