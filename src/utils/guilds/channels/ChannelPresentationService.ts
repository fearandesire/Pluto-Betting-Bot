import { createHash } from 'node:crypto'
import { ChannelType, type Message, type TextChannel } from 'discord.js'
import { SapDiscClient } from '../../../index.js'
import {
	type ChannelAggregatedV2,
	type ChannelPresentationReceipt,
	type ChannelPresentationState,
	initialOddsCompletionSchema,
} from '../../cache/data/channel-presentation-contract.js'
import type { GuildEligibility } from '../../cache/data/schemas.js'
import ChannelManager from './ChannelManager.js'
import { ChannelPresentationClient } from './channel-presentation-client.js'
import {
	type PresentationLock,
	RedisPresentationLock,
} from './channel-presentation-lock.js'
import {
	matchesGameMarker,
	V2_PRESENTATION_FOOTER,
	V2_PRESENTATION_TOPIC_SUFFIX,
	V2_PRESENTATION_UNSENT_TOPIC_SUFFIX,
} from './channel-reconciliation.js'

export interface PresentationStore {
	load(guildId: string, gameId: string): Promise<ChannelPresentationState>
	ack(
		guildId: string,
		gameId: string,
		receipt: ChannelPresentationReceipt,
	): Promise<void>
	guild(guildId: string): Promise<GuildEligibility>
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
		beforeEffect?: () => Promise<void>,
	): Promise<string>
	findMessage(
		guildId: string,
		channelId: string,
		marker: string,
		messageId?: string,
	): Promise<string | null>
	canResumeUnsent?(
		guildId: string,
		channelId: string,
		marker: string,
	): Promise<boolean>
	write(
		guild: GuildEligibility,
		channelId: string,
		channel: ChannelAggregatedV2,
		marker: string,
		messageId?: string,
		beforeEffect?: () => Promise<void>,
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
			let state = await this.store.load(guildId, gameId)
			if (state.guildId !== guildId || state.gameId !== gameId)
				throw new Error('Presentation identity mismatch')
			if (state.appliedRevision === state.desiredRevision) return
			if (!hasInitialOddsCompletion(state)) return
			const refresh = async () => {
				const current = await this.store.load(guildId, gameId)
				if (current.guildId !== guildId || current.gameId !== gameId)
					throw new Error('Presentation identity mismatch')
				if (current.appliedRevision === current.desiredRevision)
					return false
				if (!hasInitialOddsCompletion(current)) return false
				state = current
				return true
			}
			const beforeEffect = async () => {
				await check()
				if (!hasInitialOddsCompletion(state))
					throw new Error(
						'Initial odds completion expired before delivery',
					)
			}
			let guild = await this.store.guild(guildId)
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
				// Only a durable never-sent phase permits completing an empty channel.
				// Ambiguous sends and deleted messages still require reconciliation.
				if (
					!messageId &&
					!(await this.discord.canResumeUnsent?.(
						guildId,
						channelId,
						marker,
					))
				)
					throw new Error(
						'Presentation message receipt requires reconciliation',
					)
			} else {
				if (state.channelId || !allowCreate)
					throw new Error(
						'Presentation update has no confirmed channel',
					)
				// A queued event can outlive a guild configuration change. Re-read
				// preferences immediately before the first Discord side effect.
				const creationGuild = await this.store.guild(guildId)
				if (
					creationGuild.guildId !== guildId ||
					creationGuild.sport !==
						state.desiredPresentation.sport.toLowerCase()
				)
					throw new Error('Presentation guild mismatch')
				if (
					!isPresentationEligibleForGuild(
						state.desiredPresentation,
						creationGuild.preferredTeams,
					)
				)
					return
				if (!canCreatePresentation(state.desiredPresentation)) return
				if (!(await refresh())) return
				await check()
				if (!hasInitialOddsCompletion(state)) return
				if (!canCreatePresentation(state.desiredPresentation)) return
				channelId = await this.discord.create(
					creationGuild,
					state.desiredPresentation,
					marker,
					beforeEffect,
				)
				guild = creationGuild
			}
			if (!(await refresh())) return
			await check()
			if (!hasInitialOddsCompletion(state)) return
			messageId = await this.discord.write(
				guild,
				channelId,
				state.desiredPresentation,
				marker,
				messageId ?? undefined,
				beforeEffect,
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

/** Old jobs and held snapshots cannot authorize the first no-odds delivery. */
export function hasInitialOddsCompletion(
	state: ChannelPresentationState,
	now = Date.now(),
): boolean {
	if (
		state.messageId !== null ||
		state.desiredPresentation.betting.state === 'available'
	)
		return true
	const result = initialOddsCompletionSchema.safeParse(
		state.desiredPresentation.initial_odds_completion,
	)
	if (!result.success) return false
	const proof = result.data
	const completedAt = Date.parse(proof.completed_at)
	const sport =
		state.desiredPresentation.sport.toLowerCase() === 'nba'
			? 'basketball_nba'
			: state.desiredPresentation.sport.toLowerCase() === 'nfl'
				? 'americanfootball_nfl'
				: null
	return (
		proof.revision === state.desiredRevision &&
		proof.event_id === state.gameId &&
		proof.event_id === state.desiredPresentation.id &&
		proof.sport === sport &&
		completedAt <= now &&
		now - completedAt <= 15 * 60 * 1000
	)
}

export function isPresentationEligibleForGuild(
	presentation: Pick<ChannelAggregatedV2, 'home_team' | 'away_team'>,
	preferredTeams?: string[],
): boolean {
	const preferred = (preferredTeams ?? [])
		.map((team) => team.trim().toLowerCase())
		.filter(Boolean)
	if (preferred.length === 0) return true
	const teams = new Set([
		presentation.home_team.trim().toLowerCase(),
		presentation.away_team.trim().toLowerCase(),
	])
	return preferred.some((team) => teams.has(team))
}

export function canCreatePresentation(
	channel: ChannelAggregatedV2,
	now = Date.now(),
): boolean {
	const tipoff = new Date(channel.gametime).getTime()
	const observed = Date.parse(channel.schedule_observed_at ?? '')
	return (
		channel.status === 'scheduled' &&
		tipoff > now &&
		tipoff <= now + 60 * 60 * 1000 &&
		Boolean(channel.schedule_provider && channel.schedule_snapshot_ref) &&
		Number.isFinite(observed) &&
		observed <= now &&
		now - observed <= 6 * 60 * 60 * 1000
	)
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
			if (!matchesGameMarker(channel.topic, marker))
				throw new Error('Presentation channel marker mismatch')
			return channel.id
		}
		const server = SapDiscClient.guilds.cache.get(guild.guildId)
		if (!server) throw new Error('Guild unavailable')
		const channels = await server.channels.fetch()
		const matches = channels.filter(
			(channel) =>
				channel?.type === ChannelType.GuildText &&
				matchesGameMarker(channel.topic, marker),
		)
		if (matches.size > 1) throw new Error('Ambiguous presentation channels')
		return matches.first()?.id ?? null
	}
	async create(
		guild: GuildEligibility,
		channel: ChannelAggregatedV2,
		marker: string,
		beforeEffect?: () => Promise<void>,
	) {
		const server = SapDiscClient.guilds.cache.get(guild.guildId)
		const category = await server?.channels.fetch(guild.gameCategoryId)
		if (!category || category.type !== ChannelType.GuildCategory)
			throw new Error('Game category unavailable')
		await beforeEffect?.()
		if (!canCreatePresentation(channel))
			throw new Error('Presentation creation window or evidence expired')
		return (
			await server.channels.create({
				name: channel.channelname,
				type: ChannelType.GuildText,
				topic: `${marker}${V2_PRESENTATION_UNSENT_TOPIC_SUFFIX}`,
				parent: category.id,
			})
		).id
	}
	async canResumeUnsent(guildId: string, channelId: string, marker: string) {
		const channel = await this.text(guildId, channelId)
		return (
			channel.topic === `${marker}${V2_PRESENTATION_UNSENT_TOPIC_SUFFIX}`
		)
	}
	async findMessage(
		guildId: string,
		channelId: string,
		marker: string,
		messageId?: string,
	) {
		const channel = await this.text(guildId, channelId)
		if (!matchesGameMarker(channel.topic, marker))
			throw new Error('Presentation channel marker mismatch')
		const owns = (message: Message) =>
			message.author.id === SapDiscClient.user?.id &&
			message.embeds.some(
				(embed) => embed.footer?.text === V2_PRESENTATION_FOOTER,
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
		beforeEffect?: () => Promise<void>,
	) {
		const target = await this.text(guild.guildId, channelId)
		return this.manager.writePresentationMessage(
			target,
			channel,
			guild,
			marker,
			messageId,
			async () => {
				await beforeEffect?.()
				if (!messageId) {
					if (
						target.topic !==
						`${marker}${V2_PRESENTATION_UNSENT_TOPIC_SUFFIX}`
					)
						throw new Error(
							'Initial presentation send requires reconciliation',
						)
					// Persist ambiguity before the first send, after payload preparation.
					await target.setTopic(
						`${marker}${V2_PRESENTATION_TOPIC_SUFFIX}`,
					)
					await beforeEffect?.()
				}
			},
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
