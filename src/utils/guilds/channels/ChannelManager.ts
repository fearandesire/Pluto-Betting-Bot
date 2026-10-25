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
import { matchPostEmbed } from '../../../lib/discord/builders/odds.js'
import env from '../../../lib/startup/env.js'
import { findEmoji } from '../../bot_res/findEmoji.js'
import type { ChannelAggregatedV2 } from '../../cache/data/channel-presentation-contract.js'
import {
	type ChannelAggregated,
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
import { RedisPresentationLock } from './channel-presentation-lock.js'
import {
	adoptableGameChannels,
	type GameChannelLedger,
	RedisGameChannelLedger,
} from './game-channel-ledger.js'
import { createGameChannel } from './game-channel-topic.js'
import { resolveMatchupImage } from './matchup-image-resolver.js'

export const V2_PRESENTATION_FOOTER = 'Pluto | dev. fenixforever'

/**
 * Handle interactions between Pluto API & Discord user interface/interactions
 */
export default class ChannelManager {
	private readonly API_URL: string
	private ep: {
		gchan: string
	}

	constructor(
		private readonly reservations = new RedisChannelReservationStore(
			redisCache,
		),
		private readonly ledger: GameChannelLedger = new RedisGameChannelLedger(),
	) {
		this.API_URL = `${env.KH_API_URL}`
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
		for (const guild of guilds) {
			await new RedisPresentationLock().run(
				`${guild.guildId}:${channel.id}`,
				async (check) => {
					await check()
					await this.processChannelUnlocked(channel, [guild])
				},
			)
		}
	}

	private async processChannelUnlocked(
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
					findExisting: (_intent, knownChannelId) =>
						this.findGameChannel(
							intent,
							guild.gameCategoryId,
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
		}
	}

	private async findGameChannel(
		intent: ChannelIntent,
		gameCategoryId: string,
		knownChannelId?: string,
	): Promise<{ id: string } | null> {
		const guild = SapDiscClient.guilds.cache.get(intent.guildId)
		if (!guild) return null
		const knownChannel = knownChannelId
			? (guild.channels.cache.get(knownChannelId) ??
				(await guild.channels.fetch(knownChannelId).catch(() => null)))
			: null
		if (knownChannel?.type === ChannelType.GuildText) {
			return { id: knownChannel.id }
		}

		const channels =
			guild.channels.cache.size > 0
				? guild.channels.cache
				: ((await guild.channels.fetch().catch(() => null)) ??
					guild.channels.cache)
		const textChannels = channels.filter(
			(candidate) => candidate.type === ChannelType.GuildText,
		)
		const record = await this.ledger.get(intent.guildId, intent.gameId)
		const [found] = adoptableGameChannels(
			textChannels.values(),
			{ channelName: intent.channelName, gameCategoryId },
			record,
		)
		return found ? { id: found.id } : null
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
		const matchImg = await resolveMatchupImage({
			sport: channel.sport,
			awayTeam: channel.away_team,
			homeTeam: channel.home_team,
		})
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
		await this.ledger.beginCreation(intent.guildId, intent.gameId)
		const gameChannel = await createGameChannel(locatedGuild, guild, {
			name: channel.channelname,
			parent: gameCategory as CategoryChannelResolvable,
		})
		await this.ledger.recordChannel(
			intent.guildId,
			intent.gameId,
			gameChannel.id,
		)
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
		// A V2 presentation that already sent owns this channel's card.
		const record = await this.ledger.get(guild.guildId, channel.id)
		if (record?.channelId === channelId && record.delivery === 'sent')
			return
		const favoredTeamInfo = await teamResolver.resolve(
			channel.matchOdds.favored,
			{ sport: channel.sport.toLowerCase(), full: true },
		)
		this.validateFavoredTeamInfo(favoredTeamInfo)
		const matchImg = await resolveMatchupImage({
			sport: channel.sport,
			awayTeam: channel.away_team,
			homeTeam: channel.home_team,
		})
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
		channel: ChannelAggregated | ChannelAggregatedV2,
		guild: GuildEligibility,
		metadata: { favoredTeamInfo: any; matchImg: Buffer | null },
	): Promise<MessageCreateOptions> {
		const bettingAvailable =
			'betting' in channel
				? channel.betting.state === 'available' &&
					channel.status === 'scheduled' &&
					new Date(channel.gametime).getTime() > Date.now()
				: true
		const matchOdds =
			'betting' in channel
				? channel.betting.state === 'available'
					? channel.betting.matchOdds
					: undefined
				: (channel as ChannelAggregated).matchOdds
		const matchEmbed = await this.prepMatchEmbed({
			favored: bettingAvailable ? matchOdds?.favored : undefined,
			favoredTeamClr: metadata.favoredTeamInfo?.colors?.[0],
			bettingAvailable,
			gametime:
				'betting' in channel ? new Date(channel.gametime) : undefined,
			gameStatus: 'betting' in channel ? channel.status : undefined,
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

	/** V2 presentation uses the same identity-based asset and embed builders as V1. */
	async preparePresentationMessage(
		channel: ChannelAggregatedV2,
		guild: GuildEligibility,
	): Promise<MessageCreateOptions> {
		const favored =
			channel.betting.state === 'available'
				? channel.betting.matchOdds.favored
				: undefined
		const favoredTeamInfo = favored
			? await teamResolver
					.resolve(favored, {
						sport: channel.sport.toLowerCase(),
						full: true,
					})
					.catch(() => null)
			: null
		const matchImg = await resolveMatchupImage({
			sport: channel.sport,
			awayTeam: channel.away_team,
			homeTeam: channel.home_team,
		})
		const message = await this.prepareGameMessage(channel, guild, {
			favoredTeamInfo,
			matchImg,
		})
		if (message.embeds?.[0] instanceof EmbedBuilder) {
			message.embeds[0].setFooter({
				text: V2_PRESENTATION_FOOTER,
			})
		}
		return message
	}

	async writePresentationMessage(
		target: TextChannel,
		channel: ChannelAggregatedV2,
		guild: GuildEligibility,
		messageId?: string,
		beforeWrite?: () => Promise<void>,
	): Promise<string> {
		const payload = await this.preparePresentationMessage(channel, guild)
		if (!messageId) {
			await beforeWrite?.()
			return (await target.send(payload)).id
		}
		const message = await target.messages.fetch(messageId)
		await beforeWrite?.()
		return (
			await message.edit({
				embeds: payload.embeds,
				files: payload.files,
				attachments: [],
			})
		).id
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
	 * Prepares the match embed with team information and betting details
	 * @async
	 * @param {PrepareMatchEmbed} args - The arguments for preparing the match embed
	 */
	async prepMatchEmbed(args: PrepareMatchEmbed) {
		const teamEmoji = args.favored
			? ((await findEmoji(args.favored)) ?? '')
			: ''
		return { embed: matchPostEmbed(args, teamEmoji) }
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
}
