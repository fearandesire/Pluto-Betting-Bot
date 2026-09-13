import { describe, expect, it } from 'vitest'
import {
	type ChannelIntent,
	RedisChannelReservationStore,
} from '../channel-reservation-store.js'

class FakeRedis {
	private readonly values = new Map<string, string>()
	private readonly expiry = new Map<string, number>()
	private now = 0

	advance(seconds: number) {
		this.now += seconds * 1000
	}

	private purge(key: string) {
		if ((this.expiry.get(key) ?? Infinity) <= this.now) {
			this.values.delete(key)
			this.expiry.delete(key)
		}
	}

	async get(key: string) {
		this.purge(key)
		return this.values.get(key) ?? null
	}

	async set(key: string, value: string, ...options: Array<string | number>) {
		this.purge(key)
		if (options.map(String).includes('NX') && this.values.has(key))
			return null
		this.values.set(key, value)
		const exIndex = options.map(String).indexOf('EX')
		if (exIndex >= 0)
			this.expiry.set(key, this.now + Number(options[exIndex + 1]) * 1000)
		return 'OK' as const
	}

	async compareAndRemove(key: string, expectedValue: string) {
		if (this.values.get(key) !== expectedValue) return false
		this.values.delete(key)
		return true
	}

	async transitionIfValue(
		key: string,
		expectedValue: string,
		nextValue: string,
		_seconds?: number,
	) {
		this.purge(key)
		if (this.values.get(key) !== expectedValue) return false
		this.values.set(key, nextValue)
		if (_seconds !== undefined)
			this.expiry.set(key, this.now + _seconds * 1000)
		return true
	}

	async refreshIfOwned(key: string, expectedValue: string, _seconds: number) {
		this.purge(key)
		if (this.values.get(key) !== expectedValue) return false
		this.expiry.set(key, this.now + _seconds * 1000)
		return this.values.get(key) === expectedValue
	}
}

const intent: ChannelIntent = {
	guildId: 'guild-1',
	gameId: 'game-1',
	channelName: 'away-at-home',
	marker: 'pluto-game:guild-1:game-1',
}

describe('RedisChannelReservationStore', () => {
	it('allows one owner and makes concurrent contenders busy', async () => {
		const store = new RedisChannelReservationStore(new FakeRedis())

		const reservations = await Promise.all([
			store.reserve(intent, 'owner-a'),
			store.reserve(intent, 'owner-b'),
		])

		expect(
			reservations.filter(({ state }) => state === 'acquired'),
		).toHaveLength(1)
		expect(
			reservations.filter(({ state }) => state === 'busy'),
		).toHaveLength(1)
	})

	it('replays the recorded Discord channel without acquiring a new owner', async () => {
		const store = new RedisChannelReservationStore(new FakeRedis())

		const acquired = await store.reserve(intent, 'owner-a')
		expect(acquired).toEqual({ state: 'acquired', owner: 'owner-a' })
		await store.recordCreated(intent, 'owner-a', 'discord-channel-1')

		expect(await store.reserve(intent, 'owner-b')).toEqual({
			state: 'created',
			channelId: 'discord-channel-1',
		})
	})

	it('does not release another owner after ownership changes', async () => {
		const redis = new FakeRedis()
		const store = new RedisChannelReservationStore(redis)

		await store.reserve(intent, 'owner-a')
		expect(await store.release(intent, 'owner-b')).toBe(false)
		expect(await store.reserve(intent, 'owner-c')).toEqual({
			state: 'busy',
		})
	})

	it('allows a new owner after the previous lease expires', async () => {
		const redis = new FakeRedis()
		const store = new RedisChannelReservationStore(redis, {
			leaseSeconds: 5,
		})

		expect(await store.reserve(intent, 'owner-a')).toEqual({
			state: 'acquired',
			owner: 'owner-a',
		})
		redis.advance(6)
		expect(await store.reserve(intent, 'owner-b')).toEqual({
			state: 'acquired',
			owner: 'owner-b',
		})
	})
})
