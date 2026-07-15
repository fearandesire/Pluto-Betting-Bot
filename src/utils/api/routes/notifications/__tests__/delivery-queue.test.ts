import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RedisCacheClient } from '../../../../cache/redis-instance.js'
import { deliveryEnvelopeSchema } from '../delivery-contract.js'
import {
	type DeliveryDispatcher,
	type DeliveryQueuePort,
	NotificationDeliveryQueue,
} from '../delivery-queue.js'
import { RedisDeliveryStore } from '../delivery-store.js'

const envelope = deliveryEnvelopeSchema.parse({
	delivery_id: '550e8400-e29b-41d4-a716-446655440002',
	schema_version: 1,
	kind: 'prop_settled',
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: {
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440003',
		result: 'won',
		market_key: 'player_points',
		description: 'Stephen Curry',
		tallies: { correct: 1, incorrect: 0, total: 1 },
		messages: [
			{
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'message-1',
			},
			{
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'message-2',
			},
		],
	},
})

function fakeRedis(): RedisCacheClient {
	const values = new Map<string, string>()
	return {
		set: async (key, value, ...args) => {
			if (args.includes('NX') && values.has(key)) return null
			values.set(key, value)
			return 'OK'
		},
		get: async (key) => values.get(key) ?? null,
	} as unknown as RedisCacheClient
}

describe('notification delivery queue', () => {
	let queue: NotificationDeliveryQueue | undefined

	afterEach(async () => {
		await queue?.close()
	})

	it('tracks destinations independently and retries only transient failures', async () => {
		const redis = fakeRedis()
		const store = new RedisDeliveryStore(redis)
		const attempts = new Map<string, number>()
		const dispatcher: DeliveryDispatcher = {
			deliver: vi.fn(async (_payload, destinationId) => {
				const count = (attempts.get(destinationId) ?? 0) + 1
				attempts.set(destinationId, count)
				if (destinationId.endsWith('message-2') && count === 1) {
					throw new Error('Discord timeout')
				}
				return { message_id: destinationId }
			}),
		}
		queue = new NotificationDeliveryQueue({
			store,
			dispatcher,
			queue: {
				add: vi.fn(async () => undefined),
				close: vi.fn(async () => undefined),
			} satisfies DeliveryQueuePort,
			startWorker: false,
		})
		await queue.accept(envelope)
		const job = { data: envelope } as never
		await expect(queue.processJob(job)).rejects.toThrow(/retry/)
		const partial = await store.get(envelope.delivery_id)
		expect(
			partial?.destinations.map((destination) => destination.state),
		).toEqual(['delivered', 'retryable_failed'])

		await queue.processJob(job)
		const complete = await store.get(envelope.delivery_id)
		expect(complete?.state).toBe('delivered')
		expect(
			complete?.destinations.every(
				(destination) => destination.state === 'delivered',
			),
		).toBe(true)
	})
})
