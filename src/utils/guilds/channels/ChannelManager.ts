import fs from 'node:fs/promises'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SportsServing } from '@pluto-khronos/types'
import {
	AttachmentBuilder,
	type CategoryChannelResolvable,
	ChannelType,
	EmbedBuilder,
	type Guild,
	type GuildBasedChannel,
	type MessageCreateOptions,
	type TextChannel,
} from 'discord.js'
import _ from 'lodash'
import { teamResolver } from 'resolve-team'
import { SapDiscClient } from '../../../index.js'
import { findEmoji } from '../../bot_res/findEmoji.js'
import {
	type ChannelAggregated,
	type CreateChannelAndSendEmbed,
	type GuildEligibility,
	type IncomingChannelData,
	incomingChannelDataSchema,
	type PrepareMatchEmbed,
} from '../../cache/data/schemas.js'
import StringUtils from '../../common/string-utils.js'

/**
 * Handle interactions between Pluto API & Discord user interface/interactions
 */
export default class ChannelManager {
	private readonly API_URL: string
	private ep: {
		gchan: string
	}

	constructor() {
		this.API_URL = `${process.env.KH_API_URL}`
		this.ep = {
			gchan: '/channels',
		}
	}

	/**
	 * Channel Creation
	 * Embed creation & Sending on channel creation
	 * @param {IncomingChannelData} data - The data containing channels and guilds information
	 */
	async processChannels(data: IncomingChannelData) {
		const { channels, guilds } = data
		for (const guild of guilds) {
			const eligibleChannels = channels.filter((channel) =>
				guild.eligibleMatches.includes(channel.id),
			)
			for (const channel of eligibleChannels) {
				await this.processChannel(channel, [guild])
			}
		}
	}

	private async processChannel(
		channel: ChannelAggregated,
		guilds: GuildEligibility[],
	) {
		// Early check for channel existence in each guild
		for (const guild of guilds) {
			const locatedGuild = await SapDiscClient.guilds.cache.get(
				guild.guildId,
			)
			if (!locatedGuild) continue

			// Check if channel already exists and skip if it does
			const existingChannel = locatedGuild.channels.cache.find(
				(GC) =>
					GC.name.toLowerCase() === channel.channelname.toLowerCase(),
			)
			if (existingChannel) {
				return
			}
		}

		const parsedSport = await StringUtils.sportKeyTransform(
			channel.sport,
		).toLowerCase()
		channel.sport = parsedSport as SportsServing

		const { sport, matchOdds, metadata } = channel
		const { favored } = matchOdds
		const favoredTeamInfo = await teamResolver.resolve(favored, {
			sport: parsedSport,
			full: true,
		})
		this.validateFavoredTeamInfo(favoredTeamInfo)

		// Fetch vs. image for the match
		const matchImg = await this.fetchVsImg(channel.channelname, sport)

		const eligibleGuilds = guilds.filter((guild) => guild.sport === sport)

		for (const guild of eligibleGuilds) {
			await this.createChannelAndSendEmbed({
				channel,
				guild,
				metadata: { favoredTeamInfo, matchImg, ...metadata },
			})
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
		channels: ChannelAggregated[]
		guilds: GuildEligibility[]
	}) {
		// Zod Validation
		await incomingChannelDataSchema.parse(body)
		return true
	}

	/**
	 * Validates the resolved team information.
	 * @param {Object} favoredTeamInfo - The resolved team data.
	 * @throws {Error} If team colors or data are unavailable.
	 */
	validateFavoredTeamInfo(favoredTeamInfo: any) {
		if (!favoredTeamInfo || _.isEmpty(favoredTeamInfo.colors)) {
			throw new Error('Unable to resolve team colors or data')
		}
	}

	/**
	 * Creates a channel and sends an embed message to it.
	 * @async
	 * @param {CreateChannelAndSendEmbed} data - The data containing channel, guild and metadata information
	 */
	async createChannelAndSendEmbed(data: CreateChannelAndSendEmbed) {
		const { channel, guild, metadata } = data
		const locatedGuild = (await SapDiscClient.guilds.cache.get(
			guild.guildId,
		)) as Guild

		if (!locatedGuild) return null

		const guildsGameCategory = await locatedGuild.channels.cache.get(
			`${guild.gameCategoryId}`,
		)
		if (!guildsGameCategory) {
			return
		}

		const bettingChanId = guild.bettingChannelId

		const { home_team, away_team } = channel

		if (_.isEmpty(home_team) || _.isEmpty(away_team)) {
			throw new Error('Missing home and away teams in channel data.')
		}
		if (!bettingChanId) {
			throw new Error('Missing betting channel id in channel data.')
		}

		const { matchOdds } = channel
		const strUtils = new StringUtils()
		const args = {
			favored: matchOdds.favored,
			favoredTeamClr: metadata.favoredTeamInfo.colors[0],
			home_team,
			homeTeamShortName: strUtils.getShortName(home_team),
			awayTeamShortName: strUtils.getShortName(away_team),
			away_team,
			bettingChanId,
			header: metadata.headline,
			records: metadata.records,
			sport: channel.sport,
		}

		// Prepare the embed data
		const matchEmbed = await this.prepMatchEmbed(args)
		// Create an AttachmentBuilder instance with the matchImg buffer
		let attachment: AttachmentBuilder | null = null
		if (metadata.matchImg) {
			attachment = new AttachmentBuilder(metadata.matchImg, {
				name: 'match.jpg',
			})
			matchEmbed.embed.setImage('attachment://match.jpg')
		}

		// ! Create the game channel
		const gameChan: TextChannel = await locatedGuild.channels.create({
			name: `${channel.channelname}`,
			type: ChannelType.GuildText,
			topic: 'Enjoy the Game!',
			parent: guildsGameCategory as CategoryChannelResolvable,
		})

		// ? Send the embed to the game channel
		const messageOptions: MessageCreateOptions = {
			embeds: [matchEmbed.embed],
		}
		if (attachment) {
			messageOptions.files = [attachment]
		}

		await gameChan.send(messageOptions)
	}

	/**
	 * Prepares the match embed with team information and betting details
	 * @async
	 * @param {PrepareMatchEmbed} args - The arguments for preparing the match embed
	 */
	async prepMatchEmbed(args: PrepareMatchEmbed) {
		const embedClr = args.favoredTeamClr
		const teamEmoji = (await findEmoji(args.favored)) ?? ''
		const matchVersus = `${args.awayTeamShortName} @ ${args.homeTeamShortName}`

		// Build records string if available
		const recordsStr = args.records
			? `\n\n🔵 **Team Records**\n${args.awayTeamShortName}: ${args.records.away_team.total_record}\n${args.homeTeamShortName}: ${args.records.home_team.total_record}`
			: ''

		const matchEmbed = new EmbedBuilder()
			.setColor(embedClr)
			.setDescription(
				`## ${matchVersus}\n\n🔵 **Game Details**\nThe ${teamEmoji} **${args.favored}** are favored to win this match!${recordsStr}\n\n🔵 **Info**\n*Use \`/commands\` in <#${args.bettingChanId}> channel to place bets with Pluto*`,
			)
			.setFooter({
				text: 'Pluto | Created by fenixforever',
			})
		return { embed: matchEmbed }
	}

	async locateChannel(channelName: string) {
		const channelsToDelete: GuildBasedChannel[] = []
		// Iterate over all guilds the client is in
		for (const guild of SapDiscClient.guilds.cache.values()) {
			const channel = guild.channels.cache.find(
				(GC) => GC.name.toLowerCase() === channelName.toLowerCase(),
			)
			// Target Text Channels
			if (channel && channel.type !== ChannelType.GuildText) {
				return
			}
			if (channel) {
				channelsToDelete.push(channel)
			}
		}
		return channelsToDelete
	}

	/**
	 * Locate the game channel via the name and delete it
	 * @param {string} channelName - The name of the channel to locate
	 */
	async deleteChan(channelName: string) {
		const gameChans = await this.locateChannel(channelName)
		if (gameChans.length === 0) {
			return
		}
		for (const gameChan of gameChans) {
			await gameChan.delete()
		}
	}

	private async fetchVsImg(matchup: string, sport: string) {
		const matchupFileName = `${matchup
			.replace('at', 'vs')
			.replace(/-/g, '_')
			.split('_')
			.map((part) =>
				part
					.toLowerCase()
					.replace(/\b[a-z]/g, (char) => char.toUpperCase()),
			)
			.join('_')}.jpg`

		// Ensure "vs" is always lowercase
		const finalMatchupFileName = matchupFileName.replace('Vs', 'vs')

		const __filename = fileURLToPath(import.meta.url)
		const __dirname = dirname(__filename)
		try {
			// Assuming the base directory is one level up from where your script is located
			const baseDir = path.resolve(__dirname, '../../../../') // Adjust this path based on your actual project structure
			const imagePath = path.join(
				baseDir,
				'assets',
				'matchupimages',
				sport,
				finalMatchupFileName,
			)

			// Read the image file as a binary buffer
			const img = await fs.readFile(imagePath)
			if (!img) {
				return null
			}
			return img
		} catch (error) {
			console.error(error)
			return null
		}
	}
}
