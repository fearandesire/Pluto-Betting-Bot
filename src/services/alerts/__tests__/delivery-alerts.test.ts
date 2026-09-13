import { describe, expect, it, vi } from 'vitest'
import { deliveryEnvelopeSchema } from '../../../utils/api/routes/notifications/delivery-contract.js'
import {
	type DeliveryDispatcher,
	type DeliveryQueuePort,
	NotificationDeliveryQueue,
} from '../../../utils/api/routes/notifications/delivery-queue.js'
import { RedisDeliveryStore } from '../../../utils/api/routes/notifications/delivery-store.js'

const envelope = deliveryEnvelopeSchema.parse({
	delivery_id: '550e8400-e29b-41d4-a716-446655440099',
	schema_version: 1,
	kind: 'prop_settled',
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: {
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440098',
		result: 'won',
		market_key: 'player_points',
		description: 'Player',
		tallies: { correct: 1, incorrect: 0, total: 1 },
		messages: [
			{
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'message-1',
			},
		],
	},
})

function fakeRedis() {
	const values = new Map<string, string>()
	return {
		set: async (
			key: string,
			value: string,
			...args: Array<string | number>
		) => {
			if (args.includes('NX') && values.has(key)) return null
			values.set(key, value)
			return 'OK' as const
		},
		get: async (key: string) => values.get(key) ?? null,
	} as never
}

describe('notification delivery alerts', () => {
	it('reports a permanent delivery failure after attempts are exhausted', async () => {
		const reporter = {
			firing: vi.fn().mockResolvedValue(undefined),
			resolved: vi.fn().mockResolvedValue(undefined),
		}
		const dispatcher: DeliveryDispatcher = {
			deliver: vi
				.fn()
				.mockRejectedValue(
					Object.assign(new Error('bad request'), { status: 400 }),
				),
		}
		const queue = new NotificationDeliveryQueue({
			store: new RedisDeliveryStore(fakeRedis()),
			dispatcher,
			alertReporter: reporter,
			queue: {
				add: vi.fn(async () => undefined),
				close: vi.fn(async () => undefined),
			} satisfies DeliveryQueuePort,
			startWorker: false,
		})

		await queue.accept(envelope)
		await queue.processJob({
			data: envelope,
			attemptsMade: 7,
			opts: { attempts: 8 },
		} as never)

		expect(reporter.firing).toHaveBeenCalledOnce()
		await queue.close()
	})

	it('does not retry a delivered destination when alert persistence fails', async () => {
		const reporter = {
			firing: vi
				.fn()
				.mockRejectedValue(new Error('alert store unavailable')),
			resolved: vi
				.fn()
				.mockRejectedValue(new Error('alert store unavailable')),
		}
		const dispatcher: DeliveryDispatcher = {
			deliver: vi.fn().mockResolvedValue({ message_id: 'message-1' }),
		}
		const queue = new NotificationDeliveryQueue({
			store: new RedisDeliveryStore(fakeRedis()),
			dispatcher,
			alertReporter: reporter,
			queue: {
				add: vi.fn(async () => undefined),
				close: vi.fn(async () => undefined),
			} satisfies DeliveryQueuePort,
			startWorker: false,
		})

		await queue.accept(envelope)
		await queue.processJob({ data: envelope } as never)
		await queue.processJob({ data: envelope } as never)

		expect(dispatcher.deliver).toHaveBeenCalledOnce()
		await queue.close()
	})
})
