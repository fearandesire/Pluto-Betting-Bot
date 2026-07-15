import { describe, expect, it, vi } from 'vitest'

const atomicRedis = {
	compareAndRemove: vi.fn(),
	refreshIfOwned: vi.fn(),
	transitionIfValue: vi.fn(),
}

vi.mock('../redis-instance.js', () => ({
	default: atomicRedis,
}))

const { CacheManager } = await import('../cache-manager.js')

describe('CacheManager lock ownership', () => {
	it('compares the serialized token written by setIfAbsent', async () => {
		atomicRedis.compareAndRemove.mockResolvedValueOnce(true)
		const cache = new CacheManager()

		await expect(
			cache.compareAndRemove('lock-key', 'owner-token'),
		).resolves.toBe(true)
		expect(atomicRedis.compareAndRemove).toHaveBeenCalledWith(
			'lock-key',
			JSON.stringify('owner-token'),
		)
	})

	it('refreshes a reservation only while the serialized owner token matches', async () => {
		atomicRedis.refreshIfOwned.mockResolvedValueOnce(true)
		const cache = new CacheManager()

		await expect(
			cache.refreshIfOwned('placement-key', 'owner-token', 120),
		).resolves.toBe(true)
		expect(atomicRedis.refreshIfOwned).toHaveBeenCalledWith(
			'placement-key',
			JSON.stringify('owner-token'),
			120,
		)
	})

	it('transitions serialized values through the typed atomic port', async () => {
		atomicRedis.transitionIfValue.mockResolvedValueOnce(true)
		const cache = new CacheManager()

		await expect(
			cache.transitionIfValue(
				'delivery-key',
				{ status: 'pending' },
				{ status: 'processing' },
				60,
			),
		).resolves.toBe(true)
		expect(atomicRedis.transitionIfValue).toHaveBeenCalledWith(
			'delivery-key',
			JSON.stringify({ status: 'pending' }),
			JSON.stringify({ status: 'processing' }),
			60,
		)
	})
})
