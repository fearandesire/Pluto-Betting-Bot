import { SnowflakeUtil } from 'discord.js'
import { z } from 'zod'
import redisCache, {
	type RedisCacheClient,
} from '../../cache/redis-instance.js'
import { legacyTopicDelivery } from './game-channel-topic.js'

/**
 * Durable per-game channel facts. This replaced identity and delivery markers
 * that used to live in the visible channel topic.
 *
 * A crash between Discord's create call and recording the channel id is
 * recovered by adopting a same-name channel created during one of this game's
 * creation attempts that no other game owns.
 */
const gameChannelRecordSchema = z.object({
	firstAttemptAt: z.number().int().nonnegative(),
	lastAttemptAt: z.number().int().nonnegative(),
	channelId: z.string().min(1).optional(),
	/** V2 only: `sent` is written before the first send so a lost reply stays ambiguous. */
	delivery: z.enum(['unsent', 'sent']).optional(),
})
export type GameChannelRecord = z.infer<typeof gameChannelRecordSchema>
export type GameChannelDelivery = NonNullable<GameChannelRecord['delivery']>

export interface GameChannelLedger {
	get(guildId: string, gameId: string): Promise<GameChannelRecord | null>
	beginCreation(guildId: string, gameId: string): Promise<GameChannelRecord>
	recordChannel(
		guildId: string,
		gameId: string,
		channelId: string,
		delivery?: GameChannelDelivery,
	): Promise<void>
	markSent(guildId: string, gameId: string, channelId: string): Promise<void>
	/** `guildId:gameId` of the game that recorded this channel, if any. */
	ownerOf(channelId: string): Promise<string | null>
}

export interface GameChannelCandidate {
	id: string
	name: string
	parentId?: string | null
	topic?: string | null
}

const KEY_PREFIX = 'pluto:game-channel:v1:'
const OWNER_PREFIX = 'pluto:game-channel-owner:v1:'
const RECORD_TTL_SECONDS = 2 * 24 * 60 * 60
const CLOCK_SKEW_MS = 5_000
/** Upper bound on one Discord create call after its attempt was recorded. */
const CREATE_CALL_MS = 60_000

export class RedisGameChannelLedger implements GameChannelLedger {
	constructor(
		private readonly redis: Pick<
			RedisCacheClient,
			'get' | 'set'
		> = redisCache,
		private readonly now: () => number = Date.now,
	) {}

	async get(guildId: string, gameId: string) {
		const raw = await this.redis.get(ledgerKey(guildId, gameId))
		if (!raw) return null
		const parsed = gameChannelRecordSchema.safeParse(JSON.parse(raw))
		if (!parsed.success) throw new Error('Game channel record is corrupt')
		return parsed.data
	}

	async beginCreation(guildId: string, gameId: string) {
		const now = this.now()
		const current = await this.get(guildId, gameId)
		const next: GameChannelRecord = current
			? { ...current, lastAttemptAt: now }
			: { firstAttemptAt: now, lastAttemptAt: now }
		await this.write(guildId, gameId, next)
		return next
	}

	async recordChannel(
		guildId: string,
		gameId: string,
		channelId: string,
		delivery?: GameChannelDelivery,
	) {
		const current = await this.get(guildId, gameId)
		const now = this.now()
		await this.write(guildId, gameId, {
			firstAttemptAt: current?.firstAttemptAt ?? now,
			lastAttemptAt: current?.lastAttemptAt ?? now,
			channelId,
			...(delivery ? { delivery } : {}),
		})
		await this.redis.set(
			`${OWNER_PREFIX}${channelId}`,
			ownerId(guildId, gameId),
			'EX',
			RECORD_TTL_SECONDS,
		)
	}

	async markSent(guildId: string, gameId: string, channelId: string) {
		const current = await this.get(guildId, gameId)
		if (current?.channelId !== channelId || current.delivery !== 'unsent')
			throw new Error('Initial presentation send requires reconciliation')
		await this.write(guildId, gameId, { ...current, delivery: 'sent' })
	}

	ownerOf(channelId: string) {
		return this.redis.get(`${OWNER_PREFIX}${channelId}`)
	}

	private async write(
		guildId: string,
		gameId: string,
		record: GameChannelRecord,
	) {
		await this.redis.set(
			ledgerKey(guildId, gameId),
			JSON.stringify(gameChannelRecordSchema.parse(record)),
			'EX',
			RECORD_TTL_SECONDS,
		)
	}
}

export interface GameChannelKey {
	guildId: string
	gameId: string
	channelName: string
	gameCategoryId: string
}

export type LocatedGameChannel<T> = {
	channel: T
	/** `legacy` channels still show a pre-#742 marker topic. */
	via: 'recorded' | 'legacy' | 'recovered'
}

/**
 * The one lookup both channel paths use: the recorded id, then a pre-#742
 * marker topic, then a channel this game's interrupted creation produced.
 * Recovered channels are recorded so later lookups use the id.
 */
export async function locateGameChannel<T extends GameChannelCandidate>(
	ledger: GameChannelLedger,
	key: GameChannelKey,
	channels: Iterable<T>,
	recoveredDelivery?: 'unsent',
): Promise<LocatedGameChannel<T> | null> {
	const candidates = [...channels]
	const record = await ledger.get(key.guildId, key.gameId)
	if (record?.channelId) {
		const channel = candidates.find((c) => c.id === record.channelId)
		return channel ? { channel, via: 'recorded' } : null
	}

	const legacy = candidates.flatMap((channel) => {
		const delivery = legacyTopicDelivery(
			channel.topic,
			key.guildId,
			key.gameId,
		)
		return delivery ? [{ channel, delivery }] : []
	})
	if (legacy.length > 1) throw new Error('Ambiguous game channels')
	if (legacy[0]) {
		const { channel, delivery } = legacy[0]
		await ledger.recordChannel(
			key.guildId,
			key.gameId,
			channel.id,
			delivery === 'v1' ? undefined : delivery,
		)
		return { channel, via: 'legacy' }
	}

	if (!record) return null
	const owner = ownerId(key.guildId, key.gameId)
	const recovered: T[] = []
	for (const channel of attemptWindowChannels(candidates, key, record)) {
		const recordedOwner = await ledger.ownerOf(channel.id)
		if (!recordedOwner || recordedOwner === owner) recovered.push(channel)
	}
	if (recovered.length > 1) throw new Error('Ambiguous game channels')
	const [channel] = recovered
	if (!channel) return null
	await ledger.recordChannel(
		key.guildId,
		key.gameId,
		channel.id,
		recoveredDelivery,
	)
	return { channel, via: 'recovered' }
}

/** Same-name game-category channels created during this game's attempts. */
export function attemptWindowChannels<T extends GameChannelCandidate>(
	channels: Iterable<T>,
	intent: Pick<GameChannelKey, 'channelName' | 'gameCategoryId'>,
	record: Pick<GameChannelRecord, 'firstAttemptAt' | 'lastAttemptAt'>,
): T[] {
	const earliest = record.firstAttemptAt - CLOCK_SKEW_MS
	const latest = record.lastAttemptAt + CREATE_CALL_MS
	return [...channels].filter((channel) => {
		const createdAt = SnowflakeUtil.timestampFrom(channel.id)
		return (
			channel.parentId === intent.gameCategoryId &&
			channel.name.toLowerCase() === intent.channelName.toLowerCase() &&
			createdAt >= earliest &&
			createdAt <= latest
		)
	})
}

function ledgerKey(guildId: string, gameId: string): string {
	return `${KEY_PREFIX}${encodeURIComponent(guildId)}:${encodeURIComponent(gameId)}`
}

function ownerId(guildId: string, gameId: string): string {
	return `${encodeURIComponent(guildId)}:${encodeURIComponent(gameId)}`
}
