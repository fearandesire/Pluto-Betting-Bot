import { createHash } from 'node:crypto'
import { ChannelType, type Message, type TextChannel } from 'discord.js'
import { SapDiscClient } from '../../../index.js'
import type {
	ChannelAggregatedV2,
	ChannelPresentationReceipt,
	ChannelPresentationState,
} from '../../cache/data/channel-presentation-contract.js'
import type { GuildEligibility } from '../../cache/data/schemas.js'
import ChannelManager from './ChannelManager.js'
import { ChannelPresentationClient } from './channel-presentation-client.js'
import {
	type PresentationLock,
	RedisPresentationLock,
} from './channel-presentation-lock.js'

export interface PresentationStore {
	load(guildId: string, gameId: string): Promise<ChannelPresentationState>
	ack(
		guildId: string,
		gameId: string,
		receipt: ChannelPresentationReceipt,
	): Promise<void>
	guild(guildId: string, gameId: string): Promise<GuildEligibility>
}
export interface PresentationDiscord {
	findChannel(
		guild: GuildEligibility,
		marker: string,
		channelId?: string,
	): Promise<string | null>
	create(
		guild: GuildEligibility,
		channel: ChannelAggregatedV2,
		marker: string,
	): Promise<string>
	findMessage(
		guildId: string,
		channelId: string,
		marker: string,
		messageId?: string,
	): Promise<string | null>
	write(
		guild: GuildEligibility,
		channelId: string,
		channel: ChannelAggregatedV2,
		marker: string,
		messageId?: string,
	): Promise<string>
}
/** Both creation and refresh re-read authoritative state under the same per-game lease. */
export class ChannelPresentationService {
	constructor(
		private readonly store: PresentationStore,
		private readonly discord: PresentationDiscord,
		private readonly lock: PresentationLock,
	) {}

	async apply(guildId: string, gameId: string, allowCreate: boolean) {
		return this.lock.run(`${guildId}:${gameId}`, async (check) => {
			const marker = presentationMarker(guildId, gameId)
			const state = await this.store.load(guildId, gameId)
			if (state.guildId !== guildId || state.gameId !== gameId)
				throw new Error('Presentation identity mismatch')
			if (state.appliedRevision === state.desiredRevision) return
			const guild = await this.store.guild(guildId, gameId)
			if (
				guild.guildId !== guildId ||
				guild.sport !== state.desiredPresentation.sport.toLowerCase()
			)
				throw new Error('Presentation guild mismatch')
			let channelId = await this.discord.findChannel(
				guild,
				marker,
				state.channelId ?? undefined,
			)
			let messageId: string | null = null
			if (channelId) {
				messageId = await this.discord.findMessage(
					guildId,
					channelId,
					marker,
					state.messageId ?? undefined,
				)
				// An ambiguous send (or a deleted post) must never cause a second post.
				if (!messageId)
					throw new Error(
						'Presentation message receipt requires reconciliation',
					)
			} else {
				if (state.channelId || !allowCreate)
					throw new Error(
						'Presentation update has no confirmed channel',
					)
				if (
					state.desiredPresentation.status !== 'scheduled' ||
					new Date(state.desiredPresentation.gametime).getTime() <=
						Date.now()
				)
					return
				await check()
				channelId = await this.discord.create(
					guild,
					state.desiredPresentation,
					marker,
				)
			}
			await check()
			messageId = await this.discord.write(
				guild,
				channelId,
				state.desiredPresentation,
				marker,
				messageId ?? undefined,
			)
			await check()
			await this.store.ack(guildId, gameId, {
				revision: state.desiredRevision,
				channelId,
				messageId,
			})
		})
	}
}

export function presentationMarker(guildId: string, gameId: string) {
	return `pluto-game:${createHash('sha256').update(`${guildId}:${gameId}`).digest('hex').slice(0, 24)}`
}

export class DiscordPresentationPort implements PresentationDiscord {
	private readonly manager = new ChannelManager()
	private async text(
		guildId: string,
		channelId: string,
	): Promise<TextChannel> {
		const channel = await SapDiscClient.guilds.cache
			.get(guildId)
			?.channels.fetch(channelId)
		if (!channel || channel.type !== ChannelType.GuildText)
			throw new Error('Presentation channel unavailable')
		return channel
	}
	async findChannel(
		guild: GuildEligibility,
		marker: string,
		channelId?: string,
	) {
		if (channelId) {
			const channel = await this.text(guild.guildId, channelId)
			if (channel.topic !== marker)
				throw new Error('Presentation channel marker mismatch')
			return channel.id
		}
		const server = SapDiscClient.guilds.cache.get(guild.guildId)
		if (!server) throw new Error('Guild unavailable')
		const channels = await server.channels.fetch()
		const matches = channels.filter(
			(channel) =>
				channel?.type === ChannelType.GuildText &&
				channel.topic === marker,
		)
		if (matches.size > 1) throw new Error('Ambiguous presentation channels')
		return matches.first()?.id ?? null
	}
	async create(
		guild: GuildEligibility,
		channel: ChannelAggregatedV2,
		marker: string,
	) {
		const server = SapDiscClient.guilds.cache.get(guild.guildId)
		const category = await server?.channels.fetch(guild.gameCategoryId)
		if (!category || category.type !== ChannelType.GuildCategory)
			throw new Error('Game category unavailable')
		return (
			await server.channels.create({
				name: channel.channelname,
				type: ChannelType.GuildText,
				topic: marker,
				parent: category.id,
			})
		).id
	}
	async findMessage(
		guildId: string,
		channelId: string,
		marker: string,
		messageId?: string,
	) {
		const channel = await this.text(guildId, channelId)
		const owns = (message: Message) =>
			message.author.id === SapDiscClient.user?.id &&
			message.embeds.some((embed) =>
				embed.footer?.text.endsWith(` | ${marker}`),
			)

		if (messageId) {
			const message = await channel.messages.fetch(messageId)
			if (!owns(message))
				throw new Error('Presentation message marker mismatch')
			return message.id
		}
		let before: string | undefined
		const found: string[] = []
		for (let page = 0; page < 10; page++) {
			const messages = await channel.messages.fetch({
				limit: 100,
				...(before ? { before } : {}),
			})
			for (const message of messages.values())
				if (owns(message)) found.push(message.id)
			if (found.length > 1)
				throw new Error('Ambiguous presentation messages')
			if (messages.size < 100) return found[0] ?? null
			before = messages.last()?.id
		}
		throw new Error('Presentation reconciliation scan limit reached')
	}
	async write(
		guild: GuildEligibility,
		channelId: string,
		channel: ChannelAggregatedV2,
		marker: string,
		messageId?: string,
	) {
		const target = await this.text(guild.guildId, channelId)
		return this.manager.writePresentationMessage(
			target,
			channel,
			guild,
			marker,
			messageId,
		)
	}
}

export function createChannelPresentationService() {
	return new ChannelPresentationService(
		new ChannelPresentationClient(),
		new DiscordPresentationPort(),
		new RedisPresentationLock(),
	)
}
