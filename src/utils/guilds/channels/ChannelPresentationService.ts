import { ChannelType, type Message, type TextChannel } from 'discord.js'
import { SapDiscClient } from '../../../index.js'
import {
	type ChannelAggregatedV2,
	type ChannelPresentationReceipt,
	type ChannelPresentationState,
	initialOddsCompletionSchema,
} from '../../cache/data/channel-presentation-contract.js'
import type { GuildEligibility } from '../../cache/data/schemas.js'
import {
	type GameChannelStageEvent,
	logGameChannelStage,
} from '../../logging/game-channel-stage.js'
import { LeaseLostError } from './ChannelCreationWorkflow.js'
import ChannelManager, { V2_PRESENTATION_FOOTER } from './ChannelManager.js'
import { ChannelPresentationClient } from './channel-presentation-client.js'
import {
	type PresentationLock,
	RedisPresentationLock,
} from './channel-presentation-lock.js'
import {
	createRecordedGameChannel,
	type GameChannelLedger,
	locateGameChannel,
	RedisGameChannelLedger,
} from './game-channel-ledger.js'
import { createGameChannel, replaceLegacyTopic } from './game-channel-topic.js'

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
		channel: ChannelAggregatedV2,
		channelId?: string,
	): Promise<string | null>
	create(
		guild: GuildEligibility,
		channel: ChannelAggregatedV2,
		beforeEffect?: () => Promise<void>,
	): Promise<string>
	findMessage(
		guildId: string,
		channelId: string,
		messageId?: string,
	): Promise<string | null>
	canResumeUnsent?(
		guildId: string,
		gameId: string,
		channelId: string,
	): Promise<boolean>
	write(
		guild: GuildEligibility,
		channelId: string,
		channel: ChannelAggregatedV2,
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
			let state = await this.store.load(guildId, gameId)
			if (state.guildId !== guildId || state.gameId !== gameId)
				throw new Error('Presentation identity mismatch')
			const log = (
				event: Pick<
					GameChannelStageEvent,
					'stage' | 'outcome' | 'reason'
				>,
			) =>
				logGameChannelStage({
					...event,
					gameId,
					guildId,
					sport: state.desiredPresentation.sport,
				})
			if (state.appliedRevision === state.desiredRevision) {
				log({
					stage: 'posted',
					outcome: 'duplicate',
					reason: 'revision_already_applied',
				})
				return
			}
			if (!hasInitialOddsCompletion(state)) {
				log({
					stage: 'created',
					outcome: 'held',
					reason: 'awaiting_initial_odds',
				})
				return
			}
			const refresh = async () => {
				const current = await this.store.load(guildId, gameId)
				if (current.guildId !== guildId || current.gameId !== gameId)
					throw new Error('Presentation identity mismatch')
				if (current.appliedRevision === current.desiredRevision) {
					log({
						stage: 'created',
						outcome: 'duplicate',
						reason: 'revision_already_applied',
					})
					return false
				}
				if (!hasInitialOddsCompletion(current)) {
					log({
						stage: 'created',
						outcome: 'held',
						reason: 'awaiting_initial_odds',
					})
					return false
				}
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
				state.desiredPresentation,
				state.channelId ?? undefined,
			)
			let messageId: string | null = null
			let creation: 'created' | 'existing' | 'reconciled' = 'created'
			if (channelId) {
				creation = state.channelId ? 'existing' : 'reconciled'
				messageId = await this.discord.findMessage(
					guildId,
					channelId,
					state.messageId ?? undefined,
				)
				// Only a durable never-sent phase permits completing an empty channel.
				// Ambiguous sends and deleted messages still require reconciliation.
				if (
					!messageId &&
					!(await this.discord.canResumeUnsent?.(
						guildId,
						gameId,
						channelId,
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
				) {
					log({
						stage: 'created',
						outcome: 'skipped',
						reason: 'not_eligible',
					})
					return
				}
				const blocked = creationBlock(state.desiredPresentation)
				if (blocked) {
					log({ stage: 'created', ...blocked })
					return
				}
				if (!(await refresh())) return
				await check()
				if (!hasInitialOddsCompletion(state)) {
					log({
						stage: 'created',
						outcome: 'held',
						reason: 'awaiting_initial_odds',
					})
					return
				}
				const blockedAfterRefresh = creationBlock(
					state.desiredPresentation,
				)
				if (blockedAfterRefresh) {
					log({ stage: 'created', ...blockedAfterRefresh })
					return
				}
				channelId = await this.discord.create(
					creationGuild,
					state.desiredPresentation,
					beforeEffect,
				)
				guild = creationGuild
			}
			log({
				stage: 'created',
				...(creation === 'created'
					? { outcome: 'ok', reason: 'created' }
					: creation === 'reconciled'
						? { outcome: 'ok', reason: 'reconciled' }
						: { outcome: 'duplicate', reason: 'already_created' }),
			})
			if (!(await refresh())) return
			await check()
			if (!hasInitialOddsCompletion(state)) {
				log({
					stage: 'posted',
					outcome: 'held',
					reason: 'awaiting_initial_odds',
				})
				return
			}
			const edited = messageId !== null
			try {
				messageId = await this.discord.write(
					guild,
					channelId,
					state.desiredPresentation,
					messageId ?? undefined,
					beforeEffect,
				)
				await check()
				await this.store.ack(guildId, gameId, {
					revision: state.desiredRevision,
					channelId,
					messageId,
				})
			} catch (error) {
				log({
					stage: 'posted',
					outcome: 'failed',
					reason: postFailureReason(error),
				})
				throw error
			}
			log({
				stage: 'posted',
				outcome: 'ok',
				reason: edited ? 'message_updated' : 'posted',
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
	return creationBlock(channel, now) === null
}

/** Why a game cannot get a channel right now, or null when it can. */
export function creationBlock(
	channel: ChannelAggregatedV2,
	now = Date.now(),
): Pick<GameChannelStageEvent, 'outcome' | 'reason'> | null {
	const tipoff = new Date(channel.gametime).getTime()
	const observed = Date.parse(channel.schedule_observed_at ?? '')
	if (channel.status !== 'scheduled')
		return { outcome: 'skipped', reason: 'not_scheduled' }
	if (tipoff <= now) return { outcome: 'skipped', reason: 'tipoff_passed' }
	if (tipoff > now + 60 * 60 * 1000)
		return { outcome: 'deferred', reason: 'creation_window_not_open' }
	if (!(channel.schedule_provider && channel.schedule_snapshot_ref))
		return { outcome: 'held', reason: 'missing_schedule_evidence' }
	if (!Number.isFinite(observed) || observed > now)
		return { outcome: 'held', reason: 'invalid_schedule_evidence' }
	if (now - observed > 6 * 60 * 60 * 1000)
		return { outcome: 'held', reason: 'stale_schedule_evidence' }
	return null
}

function postFailureReason(error: unknown): string {
	if (error instanceof LeaseLostError) return 'lease_lost'
	const message = error instanceof Error ? error.message : ''
	if (message.includes('reconciliation')) return 'needs_reconciliation'
	return 'post_failed'
}

export class DiscordPresentationPort implements PresentationDiscord {
	private readonly manager = new ChannelManager()
	constructor(
		private readonly ledger: GameChannelLedger = new RedisGameChannelLedger(),
	) {}
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
		channel: ChannelAggregatedV2,
		channelId?: string,
	) {
		const key = {
			guildId: guild.guildId,
			gameId: channel.id,
			channelName: channel.channelname,
			gameCategoryId: guild.gameCategoryId,
		}
		if (channelId) {
			const known = await this.text(guild.guildId, channelId)
			// A channel Khronos knows from before #742 has its state in the topic.
			if (!(await this.ledger.get(guild.guildId, channel.id))) {
				const located = await locateGameChannel(this.ledger, key, [
					known,
				])
				if (located?.via === 'legacy')
					await replaceLegacyTopic(known, guild)
			}
			return known.id
		}
		const server = SapDiscClient.guilds.cache.get(guild.guildId)
		if (!server) throw new Error('Guild unavailable')
		const channels = await server.channels.fetch()
		const located = await locateGameChannel(
			this.ledger,
			key,
			[...channels.values()].filter(
				(candidate): candidate is TextChannel =>
					candidate?.type === ChannelType.GuildText,
			),
			// Creation stopped before the id was recorded, so nothing was sent.
			'unsent',
		)
		if (located?.via === 'legacy')
			await replaceLegacyTopic(located.channel, guild)
		return located?.channel.id ?? null
	}
	async create(
		guild: GuildEligibility,
		channel: ChannelAggregatedV2,
		beforeEffect?: () => Promise<void>,
	) {
		const server = SapDiscClient.guilds.cache.get(guild.guildId)
		const category = await server?.channels.fetch(guild.gameCategoryId)
		if (!category || category.type !== ChannelType.GuildCategory)
			throw new Error('Game category unavailable')
		await beforeEffect?.()
		if (!canCreatePresentation(channel))
			throw new Error('Presentation creation window or evidence expired')
		const created = await createRecordedGameChannel(
			this.ledger,
			{
				guildId: guild.guildId,
				gameId: channel.id,
				channelName: channel.channelname,
			},
			() =>
				createGameChannel(server, guild, {
					name: channel.channelname,
					parent: category.id,
				}),
			'unsent',
		)
		return created.id
	}
	async canResumeUnsent(guildId: string, gameId: string, channelId: string) {
		const record = await this.ledger.get(guildId, gameId)
		return record?.channelId === channelId && record.delivery === 'unsent'
	}
	async findMessage(guildId: string, channelId: string, messageId?: string) {
		const channel = await this.text(guildId, channelId)
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
		messageId?: string,
		beforeEffect?: () => Promise<void>,
	) {
		const target = await this.text(guild.guildId, channelId)
		return this.manager.writePresentationMessage(
			target,
			channel,
			guild,
			messageId,
			async () => {
				await beforeEffect?.()
				if (!messageId) {
					// Persist ambiguity before the first send, after payload preparation.
					await this.ledger.markSent(
						guild.guildId,
						channel.id,
						channelId,
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
