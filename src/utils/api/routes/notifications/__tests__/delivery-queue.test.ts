import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RedisCacheClient } from '../../../../cache/redis-instance.js'
import { deliveryEnvelopeSchema } from '../delivery-contract.js'
import {
	type DeliveryDispatcher,
	type DeliveryQueuePort,
	NotificationDeliveryQueue,
	SYSTEM_DISCORD_BASE_URL,
	SystemDiscordDeliveryDispatcher,
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

const propPostEnvelope = deliveryEnvelopeSchema.parse({
	delivery_id: '550e8400-e29b-41d4-a716-446655440004',
	schema_version: 1,
	kind: 'prop_post',
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: {
		props: [
			{
				event_id: 'event-1',
				commence_time: '2026-07-14T20:00:00.000Z',
				home_team: 'Home',
				away_team: 'Away',
				sport_title: 'NBA',
				market_key: 'player_points',
				bookmaker_key: 'draftkings',
				description: 'Player',
				point: 20.5,
				over: {
					outcome_uuid: '550e8400-e29b-41d4-a716-446655440005',
					outcome_name: 'Over',
					price: -110,
				},
				under: {
					outcome_uuid: '550e8400-e29b-41d4-a716-446655440006',
					outcome_name: 'Under',
					price: -110,
				},
			},
		],
		guilds: [
			{ guild_id: 'guild-1', channel_id: 'channel-1', sport: 'nba' },
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
		vi.unstubAllGlobals()
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

	it('does not report prop-post delivery until the complete receipt set exists', async () => {
		const redis = fakeRedis()
		const store = new RedisDeliveryStore(redis)
		const dispatcher: DeliveryDispatcher = {
			deliver: vi.fn(async () => []),
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

		await queue.accept(propPostEnvelope)
		await expect(
			queue.processJob({ data: propPostEnvelope } as never),
		).rejects.toThrow(/retry/)

		const record = await store.get(propPostEnvelope.delivery_id)
		expect(record?.state).toBe('retryable_failed')
		expect(record?.destinations[0]?.state).toBe('delivered')
		expect(record?.destinations[0]?.receipt).toEqual([])
	})

	it('routes system prop-post delivery only to fake-discord', async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () =>
				new Response(JSON.stringify({ id: 'fake-message-1' }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				}),
		)
		vi.stubGlobal('fetch', fetchMock)

		const receipt = await new SystemDiscordDeliveryDispatcher().deliver(
			propPostEnvelope,
			'prop-post:guild-1:channel-1:550e8400-e29b-41d4-a716-446655440005:550e8400-e29b-41d4-a716-446655440006',
		)

		expect(fetchMock).toHaveBeenCalledOnce()
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			`${SYSTEM_DISCORD_BASE_URL}/channels/channel-1/messages`,
		)
		expect(receipt).toEqual([
			{
				outcome_uuid: '550e8400-e29b-41d4-a716-446655440005',
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'fake-message-1',
			},
			{
				outcome_uuid: '550e8400-e29b-41d4-a716-446655440006',
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'fake-message-1',
			},
		])
	})
})
