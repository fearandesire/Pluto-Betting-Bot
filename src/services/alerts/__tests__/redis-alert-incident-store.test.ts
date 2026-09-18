import { describe, expect, it } from 'vitest'
import { RedisAlertIncidentStore } from '../redis-alert-incident-store.js'

class FakeRedis {
	private readonly values = new Map<string, string>()

	async get(key: string) {
		return this.values.get(key) ?? null
	}

	async set(key: string, value: string, ...options: Array<string | number>) {
		if (options.map(String).includes('NX') && this.values.has(key))
			return null
		this.values.set(key, value)
		return 'OK' as const
	}

	async transitionIfValue(
		key: string,
		expectedValue: string,
		nextValue: string,
	) {
		if (this.values.get(key) !== expectedValue) return false
		this.values.set(key, nextValue)
		return true
	}
}

const input = {
	key: 'delivery.failed' as const,
	scope: 'notification-queue',
	severity: 'warning' as const,
	title: 'Notification delivery failed',
	summary: 'A notification delivery job requires operator attention.',
	retriable: true,
	observedAt: new Date('2026-09-12T20:00:00.000Z'),
}

describe('RedisAlertIncidentStore', () => {
	it('atomically suppresses concurrent repeated firings', async () => {
		const store = new RedisAlertIncidentStore(new FakeRedis())
		const transitions = await Promise.all([
			store.recordFiring(input),
			store.recordFiring(input),
			store.recordFiring(input),
		])

		expect(transitions.filter(({ emit }) => emit)).toHaveLength(1)
		expect(transitions[transitions.length - 1].suppressedCount).toBe(2)
	})

	it('repairs malformed incident values through an atomic replacement', async () => {
		const redis = new FakeRedis()
		await redis.set(
			'pluto:alert:v1:delivery.failed:notification-queue',
			JSON.stringify({ state: 'firing', firstFiredAt: 'not-a-date' }),
		)
		const store = new RedisAlertIncidentStore(redis)

		expect((await store.recordFiring(input)).emit).toBe(true)
	})
})
