import { SnowflakeUtil } from 'discord.js'
import { z } from 'zod'
import redisCache, {
	type RedisCacheClient,
} from '../../cache/redis-instance.js'

/**
 * Durable per-game channel facts. This replaced identity and delivery markers
 * that used to live in the visible channel topic.
 *
 * `firstAttemptAt` fences recovery: a crash between Discord's create call and
 * recording the channel id is recovered by adopting only same-name channels
 * created after this game's first attempt, never an earlier game's channel.
 */
const gameChannelRecordSchema = z.object({
	firstAttemptAt: z.number().int().nonnegative(),
	channelId: z.string().min(1).optional(),
	/** V2 only: `sent` is written before the first send so a lost reply stays ambiguous. */
	delivery: z.enum(['unsent', 'sent']).optional(),
})
export type GameChannelRecord = z.infer<typeof gameChannelRecordSchema>

export interface GameChannelLedger {
	get(guildId: string, gameId: string): Promise<GameChannelRecord | null>
	beginCreation(guildId: string, gameId: string): Promise<GameChannelRecord>
	recordChannel(
		guildId: string,
		gameId: string,
		channelId: string,
		delivery?: 'unsent',
	): Promise<void>
	markSent(guildId: string, gameId: string, channelId: string): Promise<void>
}

export interface AdoptableChannel {
	id: string
	name: string
	parentId?: string | null
}

const KEY_PREFIX = 'pluto:game-channel:v1:'
const RECORD_TTL_SECONDS = 2 * 24 * 60 * 60
const CLOCK_SKEW_MS = 5_000

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
		const fresh: GameChannelRecord = { firstAttemptAt: this.now() }
		await this.redis.set(
			ledgerKey(guildId, gameId),
			JSON.stringify(fresh),
			'EX',
			RECORD_TTL_SECONDS,
			'NX',
		)
		const current = await this.get(guildId, gameId)
		if (!current) throw new Error('Game channel record was not stored')
		return current
	}

	async recordChannel(
		guildId: string,
		gameId: string,
		channelId: string,
		delivery?: 'unsent',
	) {
		const current = await this.get(guildId, gameId)
		await this.write(guildId, gameId, {
			firstAttemptAt: current?.firstAttemptAt ?? this.now(),
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

/** Channels this game's interrupted creation may have produced. */
export function adoptableGameChannels<T extends AdoptableChannel>(
	channels: Iterable<T>,
	intent: { channelName: string; gameCategoryId: string },
	record: GameChannelRecord | null,
): T[] {
	if (!record) return []
	const earliest = record.firstAttemptAt - CLOCK_SKEW_MS
	return [...channels].filter(
		(channel) =>
			channel.parentId === intent.gameCategoryId &&
			channel.name.toLowerCase() === intent.channelName.toLowerCase() &&
			SnowflakeUtil.timestampFrom(channel.id) >= earliest,
	)
}

function ledgerKey(guildId: string, gameId: string): string {
	return `${KEY_PREFIX}${encodeURIComponent(guildId)}:${encodeURIComponent(gameId)}`
}
