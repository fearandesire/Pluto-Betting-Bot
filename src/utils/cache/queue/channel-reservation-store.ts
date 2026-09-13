export interface ChannelIntent {
	guildId: string
	gameId: string
	channelName: string
	marker: string
}

export type ChannelReservation =
	| { state: 'acquired'; owner: string }
	| { state: 'created'; channelId: string }
	| { state: 'busy' }

export interface ChannelReservationStore {
	reserve(intent: ChannelIntent, owner: string): Promise<ChannelReservation>
	refresh?(intent: ChannelIntent, owner: string): Promise<boolean>
	recordCreated(
		intent: ChannelIntent,
		owner: string,
		channelId: string,
	): Promise<void>
	release(intent: ChannelIntent, owner: string): Promise<boolean>
}

interface ReservationRedis {
	get(key: string): Promise<string | null>
	set(
		key: string,
		value: string,
		...options: Array<string | number>
	): Promise<'OK' | null>
	compareAndRemove(key: string, expectedValue: string): Promise<boolean>
	transitionIfValue(
		key: string,
		expectedValue: string,
		nextValue: string,
		seconds?: number,
	): Promise<boolean>
	refreshIfOwned(
		key: string,
		expectedValue: string,
		seconds: number,
	): Promise<boolean>
}

type ReservationRecord =
	| { state: 'reserved'; owner: string }
	| { state: 'created'; channelId: string }

const KEY_PREFIX = 'pluto:channel-reservation:v1:'
const DEFAULT_LEASE_SECONDS = 5 * 60
const DEFAULT_RESULT_TTL_SECONDS = 24 * 60 * 60

export class RedisChannelReservationStore implements ChannelReservationStore {
	private readonly leaseSeconds: number
	private readonly resultTtlSeconds: number

	constructor(
		private readonly redis: ReservationRedis,
		options: {
			leaseSeconds?: number
			resultTtlSeconds?: number
		} = {},
	) {
		this.leaseSeconds = options.leaseSeconds ?? DEFAULT_LEASE_SECONDS
		this.resultTtlSeconds =
			options.resultTtlSeconds ?? DEFAULT_RESULT_TTL_SECONDS
	}

	async reserve(
		intent: ChannelIntent,
		owner: string,
	): Promise<ChannelReservation> {
		const key = reservationKey(intent)
		const current = await this.redis.get(key)
		const record = parseReservation(current)
		if (record?.state === 'created') {
			return { state: 'created', channelId: record.channelId }
		}

		const reserved: ReservationRecord = { state: 'reserved', owner }
		const acquired = await this.redis.set(
			key,
			JSON.stringify(reserved),
			'EX',
			this.leaseSeconds,
			'NX',
		)
		return acquired === 'OK'
			? { state: 'acquired', owner }
			: { state: 'busy' }
	}

	async recordCreated(
		intent: ChannelIntent,
		owner: string,
		channelId: string,
	): Promise<void> {
		const key = reservationKey(intent)
		const expected = JSON.stringify({ state: 'reserved', owner })
		const next = JSON.stringify({ state: 'created', channelId })
		const recorded = await this.redis.transitionIfValue(
			key,
			expected,
			next,
			this.resultTtlSeconds,
		)
		if (!recorded) {
			throw new Error('Channel reservation is no longer owned')
		}
	}

	async refresh(intent: ChannelIntent, owner: string): Promise<boolean> {
		return this.redis.refreshIfOwned(
			reservationKey(intent),
			JSON.stringify({ state: 'reserved', owner }),
			this.leaseSeconds,
		)
	}

	async release(intent: ChannelIntent, owner: string): Promise<boolean> {
		return this.redis.compareAndRemove(
			reservationKey(intent),
			JSON.stringify({ state: 'reserved', owner }),
		)
	}
}

function reservationKey(intent: ChannelIntent): string {
	return `${KEY_PREFIX}${encodeURIComponent(intent.guildId)}:${encodeURIComponent(intent.gameId)}`
}

function parseReservation(value: string | null): ReservationRecord | null {
	if (!value) return null
	try {
		const parsed = JSON.parse(value) as Partial<ReservationRecord>
		if (
			parsed.state === 'created' &&
			typeof parsed.channelId === 'string'
		) {
			return parsed as ReservationRecord
		}
		if (parsed.state === 'reserved' && typeof parsed.owner === 'string') {
			return parsed as ReservationRecord
		}
		return null
	} catch {
		return null
	}
}
