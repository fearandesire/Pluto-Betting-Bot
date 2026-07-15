import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AtomicCacheOperations } from '../redis-instance.js'

export interface AtomicContractClient extends AtomicCacheOperations {
	set(
		key: string,
		value: string,
		...args: Array<string | number>
	): Promise<unknown>
	get(key: string): Promise<string | null>
	del(...keys: string[]): Promise<unknown>
	ttl(key: string): Promise<number>
}

export function runAtomicCacheContract(
	name: string,
	getClient: () => AtomicContractClient,
	namespace: string,
): void {
	describe(name, () => {
		const keys = ['lock', 'lease', 'delivery'].map(
			(key) => `${namespace}:${key}`,
		)
		const [lockKey, leaseKey, deliveryKey] = keys as [
			string,
			string,
			string,
		]

		beforeEach(async () => {
			await getClient().del(...keys)
		})

		afterEach(async () => {
			await getClient().del(...keys)
		})

		it('removes a value only for its current owner', async () => {
			const client = getClient()
			await client.set(lockKey, 'owner-a')

			await expect(
				client.compareAndRemove(lockKey, 'owner-b'),
			).resolves.toBe(false)
			await expect(client.get(lockKey)).resolves.toBe('owner-a')
			await expect(
				client.compareAndRemove(lockKey, 'owner-a'),
			).resolves.toBe(true)
			await expect(client.get(lockKey)).resolves.toBeNull()
		})

		it('refreshes and replaces expiry only for the current owner', async () => {
			const client = getClient()
			await client.set(leaseKey, 'owner-a', 'EX', 2)

			await expect(
				client.refreshIfOwned(leaseKey, 'owner-b', 30),
			).resolves.toBe(false)
			const unchangedTtl = await client.ttl(leaseKey)
			expect(unchangedTtl).toBeGreaterThan(0)
			expect(unchangedTtl).toBeLessThanOrEqual(2)
			await expect(
				client.refreshIfOwned(leaseKey, 'owner-a', 30),
			).resolves.toBe(true)
			await expect(client.ttl(leaseKey)).resolves.toBeGreaterThan(20)
		})

		it('transitions values while preserving or explicitly replacing TTL', async () => {
			const client = getClient()
			await client.set(deliveryKey, 'pending', 'EX', 20)
			const originalTtl = await client.ttl(deliveryKey)

			await expect(
				client.transitionIfValue(
					deliveryKey,
					'processing',
					'delivered',
				),
			).resolves.toBe(false)
			await expect(
				client.transitionIfValue(deliveryKey, 'pending', 'processing'),
			).resolves.toBe(true)
			const preservedTtl = await client.ttl(deliveryKey)
			expect(preservedTtl).toBeGreaterThan(0)
			expect(preservedTtl).toBeLessThanOrEqual(originalTtl)
			await expect(
				client.transitionIfValue(
					deliveryKey,
					'processing',
					'delivered',
					30,
				),
			).resolves.toBe(true)
			await expect(client.ttl(deliveryKey)).resolves.toBeGreaterThan(20)
			await expect(client.get(deliveryKey)).resolves.toBe('delivered')
		})
	})
}
