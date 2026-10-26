import { SnowflakeUtil } from 'discord.js'
import { z } from 'zod'
import redisCache, {
	type RedisCacheClient,
} from '../../cache/redis-instance.js'
import {
	type PresentationLock,
	RedisPresentationLock,
} from './channel-presentation-lock.js'
import { legacyTopicDelivery } from './game-channel-topic.js'

/**
 * Durable per-game channel facts. This replaced identity and delivery markers
 * that used to live in the visible channel topic.
 *
 * A crash between Discord's create call and recording the channel id is
 * recovered by adopting a same-name channel created during one of this game's
 * creation attempts that no other game owns. An attempt that never settled
 * (the process stopped mid-call, possibly while discord.js waited out a rate
 * limit) leaves the window open: its channel can appear arbitrarily late.
 * Creating and recovering hold one lock per guild and channel name, so a
 * recovery never sees another same-name game between its create and record.
 */
const gameChannelRecordSchema = z.object({
	firstAttemptAt: z.number().int().nonnegative(),
	lastAttemptAt: z.number().int().nonnegative(),
	/** Set when the latest attempt's create call returned or threw. */
	lastAttemptSettledAt: z.number().int().nonnegative().optional(),
	channelId: z.string().min(1).optional(),
	/** V2 only: `sent` is written before the first send so a lost reply stays ambiguous. */
	delivery: z.enum(['unsent', 'sent']).optional(),
})
export type GameChannelRecord = z.infer<typeof gameChannelRecordSchema>
export type GameChannelDelivery = NonNullable<GameChannelRecord['delivery']>

export interface GameChannelLedger {
	get(guildId: string, gameId: string): Promise<GameChannelRecord | null>
	beginCreation(guildId: string, gameId: string): Promise<GameChannelRecord>
	settleAttempt(guildId: string, gameId: string): Promise<void>
	recordChannel(
		guildId: string,
		gameId: string,
		channelId: string,
		delivery?: GameChannelDelivery,
	): Promise<void>
	markSent(guildId: string, gameId: string, channelId: string): Promise<void>
	/** `guildId:gameId` of the game that recorded this channel, if any. */
	ownerOf(channelId: string): Promise<string | null>
	/**
	 * Runs `action` holding the lock for one channel name in a guild. `check`
	 * throws once the lease is lost; call it before each durable write.
	 */
	exclusive<T>(
		guildId: string,
		channelName: string,
		action: (check: () => Promise<void>) => Promise<T>,
	): Promise<T>
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

export class RedisGameChannelLedger implements GameChannelLedger {
	constructor(
		private readonly redis: Pick<
			RedisCacheClient,
			'get' | 'set'
		> = redisCache,
		private readonly now: () => number = Date.now,
		private readonly lock: PresentationLock = new RedisPresentationLock(),
	) {}

	exclusive<T>(
		guildId: string,
		channelName: string,
		action: (check: () => Promise<void>) => Promise<T>,
	): Promise<T> {
		return this.lock.run(
			`game-channel-name:${encodeURIComponent(guildId)}:${encodeURIComponent(channelName.toLowerCase())}`,
			action,
		)
	}

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
			? {
					firstAttemptAt: current.firstAttemptAt,
					lastAttemptAt: now,
					...(current.channelId
						? { channelId: current.channelId }
						: {}),
					...(current.delivery ? { delivery: current.delivery } : {}),
				}
			: { firstAttemptAt: now, lastAttemptAt: now }
		await this.write(guildId, gameId, next)
		return next
	}

	async settleAttempt(guildId: string, gameId: string) {
		const current = await this.get(guildId, gameId)
		if (!current) return
		await this.write(guildId, gameId, {
			...current,
			lastAttemptSettledAt: this.now(),
		})
	}

	async recordChannel(
		guildId: string,
		gameId: string,
		channelId: string,
		delivery?: GameChannelDelivery,
	) {
		// A channel belongs to one game for good: the owner key is write-once.
		const owner = ownerId(guildId, gameId)
		const claimed = await this.redis.set(
			`${OWNER_PREFIX}${channelId}`,
			owner,
			'EX',
			RECORD_TTL_SECONDS,
			'NX',
		)
		if (claimed !== 'OK' && (await this.ownerOf(channelId)) !== owner)
			throw new Error('Game channel is recorded by another game')
		const current = await this.get(guildId, gameId)
		const now = this.now()
		await this.write(guildId, gameId, {
			firstAttemptAt: current?.firstAttemptAt ?? now,
			lastAttemptAt: current?.lastAttemptAt ?? now,
			lastAttemptSettledAt: current?.lastAttemptSettledAt ?? now,
			channelId,
			...(delivery ? { delivery } : {}),
		})
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
	return ledger.exclusive(key.guildId, key.channelName, async (check) => {
		const owner = ownerId(key.guildId, key.gameId)
		const recovered: T[] = []
		for (const channel of attemptWindowChannels(candidates, key, record)) {
			const recordedOwner = await ledger.ownerOf(channel.id)
			if (!recordedOwner || recordedOwner === owner)
				recovered.push(channel)
		}
		if (recovered.length > 1) throw new Error('Ambiguous game channels')
		const [channel] = recovered
		if (!channel) return null
		await check()
		await ledger.recordChannel(
			key.guildId,
			key.gameId,
			channel.id,
			recoveredDelivery,
		)
		return { channel, via: 'recovered' as const }
	})
}

/**
 * The one way to create a game channel and record it: holds the channel-name
 * lock from the first attempt marker until the channel and its owner are
 * recorded.
 */
export function createRecordedGameChannel<C extends { id: string }>(
	ledger: GameChannelLedger,
	key: Pick<GameChannelKey, 'guildId' | 'gameId' | 'channelName'>,
	create: () => Promise<C>,
	delivery?: 'unsent',
): Promise<C> {
	return ledger.exclusive(key.guildId, key.channelName, async (check) => {
		await ledger.beginCreation(key.guildId, key.gameId)
		const created = await create().finally(() =>
			ledger.settleAttempt(key.guildId, key.gameId),
		)
		// A lost lease means another game may have recovered this channel.
		// Leave it unrecorded here; reconciliation decides on the next run.
		await check()
		await ledger.recordChannel(
			key.guildId,
			key.gameId,
			created.id,
			delivery,
		)
		return created
	})
}

/** Same-name game-category channels created during this game's attempts. */
export function attemptWindowChannels<T extends GameChannelCandidate>(
	channels: Iterable<T>,
	intent: Pick<GameChannelKey, 'channelName' | 'gameCategoryId'>,
	record: Pick<GameChannelRecord, 'firstAttemptAt' | 'lastAttemptSettledAt'>,
): T[] {
	const earliest = record.firstAttemptAt - CLOCK_SKEW_MS
	const latest =
		record.lastAttemptSettledAt === undefined
			? Number.POSITIVE_INFINITY
			: record.lastAttemptSettledAt + CLOCK_SKEW_MS
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
