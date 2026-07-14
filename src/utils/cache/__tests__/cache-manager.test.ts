import { describe, expect, it, vi } from 'vitest'

const evalRedis = vi.fn()

vi.mock('../redis-instance.js', () => ({
	default: { eval: evalRedis },
}))

const { CacheManager } = await import('../cache-manager.js')

describe('CacheManager lock ownership', () => {
	it('compares the serialized token written by setIfAbsent', async () => {
		evalRedis.mockResolvedValueOnce(1)
		const cache = new CacheManager()

		await expect(
			cache.compareAndRemove('lock-key', 'owner-token'),
		).resolves.toBe(true)
		expect(evalRedis).toHaveBeenCalledWith(
			expect.stringContaining("redis.call('get', KEYS[1])"),
			1,
			'lock-key',
			JSON.stringify('owner-token'),
		)
	})

	it('refreshes a reservation only while the serialized owner token matches', async () => {
		evalRedis.mockResolvedValueOnce(1)
		const cache = new CacheManager()

		await expect(
			cache.refreshIfOwned('placement-key', 'owner-token', 120),
		).resolves.toBe(true)
		expect(evalRedis).toHaveBeenCalledWith(
			expect.stringContaining("redis.call('expire', KEYS[1], ARGV[2])"),
			1,
			'placement-key',
			JSON.stringify('owner-token'),
			120,
		)
	})
})
