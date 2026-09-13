import { createHash } from 'node:crypto'
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
import env from '../../../lib/startup/env.js'
import { findEmoji } from '../../bot_res/findEmoji.js'
import {
	type ChannelAggregated,
	type CreateChannelAndSendEmbed,
	type GuildEligibility,
	type IncomingChannelData,
	incomingChannelDataSchema,
	type PrepareMatchEmbed,
} from '../../cache/data/schemas.js'
import {
	type ChannelIntent,
	RedisChannelReservationStore,
} from '../../cache/queue/channel-reservation-store.js'
import redisCache from '../../cache/redis-instance.js'
import StringUtils from '../../common/string-utils.js'
import { logger } from '../../logging/WinstonLogger.js'
import {
	ChannelCreationBusyError,
	ChannelCreationWorkflow,
	type CreatedChannel,
} from './ChannelCreationWorkflow.js'
import { buildRecordsStr } from './matchEmbedUtils.js'

/**
 * Handle interactions between Pluto API & Discord user interface/interactions
 */
export default class ChannelManager {
	private readonly API_URL: string
	private readonly reservations: RedisChannelReservationStore
	private ep: {
		gchan: string
	}

	constructor(reservations = new RedisChannelReservationStore(redisCache)) {
		this.API_URL = `${env.KH_API_URL}`
		this.reservations = reservations
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
		const parsedSport = await StringUtils.sportKeyTransform(
			channel.sport,
		).toLowerCase()
		channel.sport = parsedSport as SportsServing

		const eligibleGuilds = guilds.filter(
			(guild) => guild.sport === channel.sport,
		)

		for (const guild of eligibleGuilds) {
			const intent = this.channelIntent(channel, guild)
			const workflow = new ChannelCreationWorkflow({
				reservations: this.reservations,
				discord: {
					findByMarker: (_intent, knownChannelId) =>
						this.findChannelByMarker(
							guild.guildId,
							intent,
							knownChannelId,
						),
					completeExisting: (_intent, channelId) =>
						this.completeExistingChannel(channel, guild, channelId),
					create: () =>
						this.createReservedChannel(channel, guild, intent),
				},
			})
			const outcome = await workflow.run(intent)
			if (outcome.state === 'busy') {
				throw new ChannelCreationBusyError()
			}
		}
	}

	private channelIntent(
		channel: ChannelAggregated,
		guild: GuildEligibility,
	): ChannelIntent {
		return {
			guildId: guild.guildId,
			gameId: channel.id,
			channelName: channel.channelname,
			marker: `pluto-game:${createHash('sha256')
				.update(`${guild.guildId}:${channel.id}`)
				.digest('hex')
				.slice(0, 24)}`,
		}
	}

	private async findChannelByMarker(
		guildId: string,
		intent: ChannelIntent,
		knownChannelId?: string,
	): Promise<{ id: string } | null> {
		const guild = SapDiscClient.guilds.cache.get(guildId)
		if (!guild) return null
		const knownChannel = knownChannelId
			? (guild.channels.cache.get(knownChannelId) ??
				(await guild.channels.fetch(knownChannelId).catch(() => null)))
			: null
		if (knownChannel?.type === ChannelType.GuildText) {
			return { id: knownChannel.id }
		}

		const fetchedChannels = await guild.channels.fetch().catch(() => null)
		const channels = fetchedChannels ?? guild.channels.cache
		const found = channels.find(
			(candidate) =>
				candidate.type === ChannelType.GuildText &&
				candidate.topic === intent.marker,
		)
		if (found) return { id: found.id }
		const legacy = channels.find(
			(candidate) =>
				candidate.type === ChannelType.GuildText &&
				candidate.name.toLowerCase() ===
					intent.channelName.toLowerCase(),
		)
		return legacy ? { id: legacy.id } : null
	}

	private async createReservedChannel(
		channel: ChannelAggregated,
		guild: GuildEligibility,
		intent: ChannelIntent,
	): Promise<CreatedChannel> {
		const favoredTeamInfo = await teamResolver.resolve(
			channel.matchOdds.favored,
			{ sport: channel.sport.toLowerCase(), full: true },
		)
		this.validateFavoredTeamInfo(favoredTeamInfo)
		const matchImg = await this.fetchVsImg(
			channel.channelname,
			channel.sport,
		)
		const messageOptions = await this.prepareGameMessage(channel, guild, {
			favoredTeamInfo,
			matchImg,
		})
		const locatedGuild = SapDiscClient.guilds.cache.get(guild.guildId)
		if (!locatedGuild) throw new Error('Guild is no longer available')
		let gameCategory = locatedGuild.channels.cache.get(guild.gameCategoryId)
		if (!gameCategory) {
			gameCategory = await locatedGuild.channels
				.fetch(guild.gameCategoryId)
				.catch(() => null)
		}
		if (!gameCategory || gameCategory.type !== ChannelType.GuildCategory) {
			throw new Error('Game category is unavailable')
		}
		const gameChannel = await locatedGuild.channels.create({
			name: channel.channelname,
			type: ChannelType.GuildText,
			topic: intent.marker,
			parent: gameCategory as CategoryChannelResolvable,
		})
		return {
			channelId: gameChannel.id,
			complete: () =>
				gameChannel.send(messageOptions).then(() => undefined),
		}
	}

	private async completeExistingChannel(
		channel: ChannelAggregated,
		guild: GuildEligibility,
		channelId: string,
	): Promise<void> {
		const locatedGuild = SapDiscClient.guilds.cache.get(guild.guildId)
		const existing =
			locatedGuild?.channels.cache.get(channelId) ??
			(await locatedGuild?.channels.fetch(channelId).catch(() => null))
		if (!existing || existing.type !== ChannelType.GuildText) {
			throw new Error('Reserved game channel is unavailable')
		}
		const favoredTeamInfo = await teamResolver.resolve(
			channel.matchOdds.favored,
			{ sport: channel.sport.toLowerCase(), full: true },
		)
		this.validateFavoredTeamInfo(favoredTeamInfo)
		const matchImg = await this.fetchVsImg(
			channel.channelname,
			channel.sport,
		)
		const messageOptions = await this.prepareGameMessage(channel, guild, {
			favoredTeamInfo,
			matchImg,
		})
		const expectedDescription =
			messageOptions.embeds?.[0] instanceof EmbedBuilder
				? messageOptions.embeds[0].data.description
				: undefined
		const recentMessages = await existing.messages
			.fetch({ limit: 10 })
			.catch(() => null)
		if (
			expectedDescription &&
			recentMessages?.some((message) =>
				message.embeds.some(
					(embed) => embed.description === expectedDescription,
				),
			)
		) {
			return
		}
		await existing.send(messageOptions)
	}

	private async prepareGameMessage(
		channel: ChannelAggregated,
		guild: GuildEligibility,
		metadata: { favoredTeamInfo: any; matchImg: Buffer | null },
	): Promise<MessageCreateOptions> {
		const matchEmbed = await this.prepMatchEmbed({
			favored: channel.matchOdds.favored,
			favoredTeamClr: metadata.favoredTeamInfo.colors[0],
			home_team: channel.home_team,
			homeTeamShortName: new StringUtils().getShortName(
				channel.home_team,
			),
			away_team: channel.away_team,
			awayTeamShortName: new StringUtils().getShortName(
				channel.away_team,
			),
			bettingChanId: guild.bettingChannelId,
			header: channel.metadata?.headline ?? '',
			sport: channel.sport,
			records: channel.metadata?.records ?? null,
		})
		const messageOptions: MessageCreateOptions = {
			embeds: [matchEmbed.embed],
		}
		if (metadata.matchImg) {
			const attachment = new AttachmentBuilder(metadata.matchImg, {
				name: 'match.jpg',
			})
			matchEmbed.embed.setImage('attachment://match.jpg')
			messageOptions.files = [attachment]
		}
		return messageOptions
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

		let guildsGameCategory = locatedGuild.channels.cache.get(
			guild.gameCategoryId,
		)
		if (!guildsGameCategory) {
			const fetched = await locatedGuild.channels
				.fetch(guild.gameCategoryId)
				.catch(() => null)
			if (fetched) guildsGameCategory = fetched
		}
		if (!guildsGameCategory) {
			throw new Error(
				`Game category channel not found — verify the category exists and the bot has access to it. guildId=${guild.guildId} gameCategoryId=${guild.gameCategoryId} channelName=${channel.channelname}`,
			)
		}
		if (guildsGameCategory.type !== ChannelType.GuildCategory) {
			throw new Error(
				`Channel ${guild.gameCategoryId} is not a category channel. guildId=${guild.guildId} channelName=${channel.channelname}`,
			)
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

		const recordsStr = buildRecordsStr(args)

		const matchEmbed = new EmbedBuilder()
			.setColor(embedClr)
			.setDescription(
				`# ${matchVersus}\n\n> ${teamEmoji}  **${args.favored}** opens as the favorite.${recordsStr}\n\n**Place your bets** → \`/commands\` in <#${args.bettingChanId}>`,
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
