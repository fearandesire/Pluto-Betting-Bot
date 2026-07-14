import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAtomicCacheContract } from './redis-atomic-contract.js'

vi.mock('../../../lib/startup/env.js', () => ({
	default: { USE_MOCK_DATA: true },
}))

vi.mock('../../logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const { InMemoryRedis } = await import('../redis-instance.js')

let now = 0
let redis: InstanceType<typeof InMemoryRedis>

beforeEach(() => {
	now = 0
	redis = new InMemoryRedis(() => now)
})

runAtomicCacheContract(
	'InMemoryRedis atomic contract',
	() => redis,
	'pluto:test:atomic:memory',
)

describe('InMemoryRedis expiry parity', () => {
	it('expires EX values at the exact boundary for get and exists', async () => {
		await redis.set('builder', 'value', 'EX', 15)

		now = 14_999
		await expect(redis.get('builder')).resolves.toBe('value')
		await expect(redis.exists('builder')).resolves.toBe(1)
		now = 15_000
		await expect(redis.get('builder')).resolves.toBeNull()
		await expect(redis.exists('builder')).resolves.toBe(0)
	})

	it('allows NX after expiration but not before it', async () => {
		await expect(redis.set('lock', 'owner-a', 'EX', 5, 'NX')).resolves.toBe(
			'OK',
		)
		await expect(
			redis.set('lock', 'owner-b', 'EX', 5, 'NX'),
		).resolves.toBeNull()

		now = 5_000
		await expect(redis.set('lock', 'owner-b', 'EX', 5, 'NX')).resolves.toBe(
			'OK',
		)
	})

	it('implements setex and expire with the injected clock', async () => {
		await redis.setex('one', 10, 'value')
		now = 4_000
		await expect(redis.expire('one', 2)).resolves.toBe(1)
		now = 5_999
		await expect(redis.get('one')).resolves.toBe('value')
		now = 6_000
		await expect(redis.get('one')).resolves.toBeNull()
		await expect(redis.expire('missing', 2)).resolves.toBe(0)
	})

	it('reports Redis-compatible TTL states and boundaries', async () => {
		await expect(redis.ttl('missing')).resolves.toBe(-2)
		await redis.set('persistent', 'value')
		await expect(redis.ttl('persistent')).resolves.toBe(-1)
		await redis.set('expiring', 'value', 'EX', 15)
		await expect(redis.ttl('expiring')).resolves.toBe(15)

		now = 14_001
		await expect(redis.ttl('expiring')).resolves.toBe(1)
		now = 14_501
		await expect(redis.ttl('expiring')).resolves.toBe(0)
		now = 15_000
		await expect(redis.ttl('expiring')).resolves.toBe(-2)
	})

	it('rejects fractional expiry arguments', async () => {
		await expect(
			redis.set('fractional', 'value', 'EX', 1.5),
		).rejects.toThrow('positive integer')
		await redis.set('existing', 'value')
		await expect(redis.expire('existing', 1.5)).rejects.toThrow('integer')
		await expect(redis.expire('missing', 1.5)).rejects.toThrow('integer')
	})

	it('fails visibly when raw Lua bypasses the typed operation port', async () => {
		await expect(redis.eval('return 1', 0)).rejects.toThrow(
			'Raw Redis eval is unsupported',
		)
	})
})
