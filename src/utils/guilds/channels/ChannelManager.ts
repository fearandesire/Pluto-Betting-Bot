import { SapDiscClient } from '../../../index.js';
import { resolveTeam } from 'resolve-team';
import _ from 'lodash';
import {
	AttachmentBuilder,
	CategoryChannelResolvable,
	ChannelType,
	ColorResolvable,
	EmbedBuilder,
	Guild,
	GuildBasedChannel,
	MessageCreateOptions,
	TextChannel,
} from 'discord.js';
import { findEmoji } from '../../bot_res/findEmoji.js';
import { IChannelAggregated } from '../../api/routes/channels/createchannels.interface.js';
import {
	ICategoryData,
	IConfigRow,
	SportsServing,
} from '../../api/common/interfaces/kh-pluto/kh-pluto.interface.js';
import path, { dirname } from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import StringUtils from '../../common/string-utils.js';

interface IPrepareMatchEmbed {
	favored: string;
	favoredTeamClr: ColorResolvable;
	home_team: string;
	homeTeamShortName: string;
	away_team: string;
	awayTeamShortName: string;
	bettingChanId: string;
	header: string;
	sport: SportsServing;
}

/**
 * Handle interactions between Pluto API & Discord user interface/interactions
 */
export default class ChannelManager {
	private readonly API_URL: string;
	private ep: {
		gchan: string;
	};

	constructor() {
		this.API_URL = `${process.env.KH_API_URL}`;
		this.ep = {
			gchan: `/channels`,
		};
	}

	/**
	 * Channel Creation
	 * Embed creation & Sending on channel creation
	 * @param {Object} channel - The channel data to process.
	 * @param {Array} betChanRows - Array of betting channel data.
	 * @param {Object} categoriesServing - Arrays of categories separated by sport.
	 * These are the categories that Pluto is serving,
	 * and is where we will be creating the channels.
	 */
	async processChannels(
		channel: IChannelAggregated,
		betChanRows: IConfigRow[],
		categoriesServing: ICategoryData,
	) {
		const parsedSport = await StringUtils.sportKeyTransform(
			channel.sport,
		).toLowerCase();
		channel.sport = parsedSport as SportsServing;
		const { sport, matchOdds } = channel;
		const { favored } = matchOdds;
		const favoredTeamInfo = await resolveTeam(favored, {
			sport: sport,
			full: true,
		});
		this.validateFavoredTeamInfo(favoredTeamInfo);

		// ? Create channels by sport
		const gameCategories = categoriesServing[sport];
		if (!gameCategories || _.isEmpty(gameCategories)) {
			return;
		}
		const matchImg = await this.fetchVsImg(channel.channelname, sport);
		for (const gameCatRow of gameCategories) {
			await this.createChannelAndSendEmbed(
				channel,
				gameCatRow,
				betChanRows,
				favoredTeamInfo,
				matchImg,
			);
		}
	}

	/**
	 * Validates and parses incoming channel data from the request
	 * @summary Verifies via `channels` length and `bettingChannelRows` length
	 * @async
	 * @returns {Array} Array of channel data objects.
	 * @throws {Error} If no channels data is received.
	 */
	async validateAndParseChannels(body: {
		channels: IChannelAggregated[];
		bettingChannelRows: IConfigRow[];
	}) {
		// Directly checking for non-empty arrays
		if (
			!Array.isArray(body.channels) ||
			body.channels.length === 0 ||
			!Array.isArray(body.bettingChannelRows) ||
			body.bettingChannelRows.length === 0
		) {
			console.error(
				`[validateAndParseChannels] Validation failed. Channels: ${JSON.stringify(body.channels)}, BettingChannelRows: ${JSON.stringify(body.bettingChannelRows)}`,
			);
			return false;
		}
		return true;
	}

	/**
	 * Validates the resolved team information.
	 * @param {Object} favoredTeamInfo - The resolved team data.
	 * @throws {Error} If team colors or data are unavailable.
	 */
	validateFavoredTeamInfo(favoredTeamInfo: any) {
		if (!favoredTeamInfo || _.isEmpty(favoredTeamInfo.colors)) {
			throw new Error('Unable to resolve team colors or data');
		}
	}

	/**
	 * Creates a channel and sends an embed message to it.
	 * @async
	 * @param {Object} channel - Channel data.
	 * @param {Object} configRow - Category data.
	 * @param {Array} bettingChanRows - Array of betting channel data.
	 * @param {Object} favoredTeamInfo - Resolved team information.
	 * @param {Buffer} matchImg - The image for the match
	 */
	async createChannelAndSendEmbed(
		channel: IChannelAggregated,
		configRow: IConfigRow,
		bettingChanRows: IConfigRow[],
		favoredTeamInfo: any,
		matchImg: Buffer | null,
	) {
		const guild: Guild = SapDiscClient.guilds.cache.get(
			configRow.guild_id,
		) as Guild;

		if (!guild) return null;

		// Prevent creating duplicate channels
		if (
			await guild.channels.cache.find(
				(GC) => GC.name.toLowerCase() === channel.channelname.toLowerCase(),
			)
		) {
			return;
		}

		const guildsCategory = guild.channels.cache.get(
			`${configRow.setting_value}`,
		);
		if (!guildsCategory) {
			return;
		}

		// Locate the betting channel for the guild
		const sortedBetChan = bettingChanRows.find(
			(row) => row.guild_id === guild.id,
		);

		const bettingChanId = sortedBetChan?.setting_value;
		const { home_team, away_team } = channel;
		if (_.isEmpty(home_team) || _.isEmpty(away_team)) {
			throw new Error(`Missing home and away teams in channel data.`);
		}
		if (!bettingChanId) {
			throw new Error(`Missing betting channel id in channel data.`);
		}

		const { matchOdds } = channel;
		const strUtils = new StringUtils();
		const args = {
			favored: matchOdds.favored,
			favoredTeamClr: favoredTeamInfo.colors[0],
			home_team,
			homeTeamShortName: strUtils.getShortName(home_team),
			awayTeamShortName: strUtils.getShortName(away_team),
			away_team,
			bettingChanId,
			header: channel.matchData.headline,
			sport: channel.sport,
		};

		const matchEmbed = await this.prepMatchEmbed(args);
		// Correctly create an AttachmentBuilder instance with the matchImg buffer
		let attachment: AttachmentBuilder | null = null;
		if (matchImg) {
			attachment = new AttachmentBuilder(matchImg, { name: 'match.jpg' });
			matchEmbed.embed.setImage('attachment://match.jpg');
		}

		const gameChan: TextChannel = await guild.channels.create({
			name: `${channel.channelname}`,
			type: ChannelType.GuildText,
			topic: 'Enjoy the Game!',
			parent: guildsCategory as CategoryChannelResolvable,
		});

		// Check if the created channel is a TextChannel before using TextChannel-specific methods
		const messageOptions: MessageCreateOptions = {
			embeds: [matchEmbed.embed],
		};
		// Only include 'files' property if attachment is found
		if (attachment) {
			messageOptions['files'] = [attachment];
		}

		await gameChan.send(messageOptions);
	}

	async prepMatchEmbed(args: IPrepareMatchEmbed) {
		const embedClr = args.favoredTeamClr;
		const teamEmoji = (await findEmoji(args.favored)) ?? '';
		const matchVersus = `${args.awayTeamShortName} @ ${args.homeTeamShortName}`;
		// const parseHeaderEmoji = SportEmojis[args.sport]
		// const sanitizedHeader =
		// 	args?.header ?? args?.header?.replace(/-/, '|') ?? ''
		const matchEmbed = new EmbedBuilder()
			.setColor(embedClr)
			// Inserting for the playoffs, but will need to be reviewed for regular season
			.setDescription(
				`## ${matchVersus}\n\n🔵 **Game Details**\nThe ${teamEmoji} **${args.favored}** are favored to win this match!\n\n🔵 **Info**\n*Use \`/commands\` in <#${args.bettingChanId}> channel to place bets with Pluto*`,
			)
			.setFooter({
				text: 'Pluto | Created by fenixforever',
			});
		return { embed: matchEmbed };
	}

	async locateChannel(channelName: string) {
		const channelsToDelete: GuildBasedChannel[] = [];
		// Iterate over all guilds the client is in
		SapDiscClient.guilds.cache.forEach((guild: Guild) => {
			const channel = guild.channels.cache.find(
				(GC) => GC.name.toLowerCase() === channelName.toLowerCase(),
			);
			// Target Text Channels
			if (channel && channel.type !== ChannelType.GuildText) {
				return;
			}
			if (channel) {
				channelsToDelete.push(channel);
			}
		});
		return channelsToDelete;
	}

	/**
	 * Locate the game channel via the name and delete it
	 * @param {string} channelName - The name of the channel to locate
	 */
	async deleteChan(channelName: string) {
		const gameChans = await this.locateChannel(channelName);
		if (gameChans.length === 0) {
			return;
		}
		for (const gameChan of gameChans) {
			await gameChan.delete();
		}
	}

	private async fetchVsImg(matchup: string, sport: string) {
		const matchupFileName =
			matchup
				.replace('at', 'vs') // Ensure "at" is replaced with "vs" first
				.replace(/-/g, '_') // Replace ALL instances of "-" with "_"
				.split('_')
				.map((part) =>
					// Convert each part to Start Case without lodash
					part
						.toLowerCase()
						.replace(/\b[a-z]/g, (char) => char.toUpperCase()),
				)
				.join('_') + '.jpg';

		// Ensure "vs" is always lowercase
		const finalMatchupFileName = matchupFileName.replace('Vs', 'vs');

		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		try {
			// Assuming the base directory is one level up from where your script is located
			const baseDir = path.resolve(__dirname, '../../../../'); // Adjust this path based on your actual project structure
			const imagePath = path.join(
				baseDir,
				'assets',
				'matchupimages',
				sport,
				finalMatchupFileName,
			);

			// Read the image file as a binary buffer
			const img = await fs.readFile(imagePath);
			if (!img) {
				return null;
			}
			return img;
		} catch (error) {
			console.error(error);
			return null;
		}
	}
}
