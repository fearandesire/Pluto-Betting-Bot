import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RedisCacheClient } from '../../../../cache/redis-instance.js'
import { deliveryEnvelopeSchema, destinationIds } from '../delivery-contract.js'
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

const secondBoardProp = {
	...{
		event_id: 'event-1',
		commence_time: '2026-07-14T20:00:00.000Z',
		home_team: 'Home',
		away_team: 'Away',
		sport_title: 'NBA',
		market_key: 'player_points',
		bookmaker_key: 'draftkings',
		description: 'Second Player',
		point: 21.5,
	},
	over: {
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440015',
		outcome_name: 'Over',
		price: 105,
	},
	under: {
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440016',
		outcome_name: 'Under',
		price: -125,
	},
}

const boardEnvelope = deliveryEnvelopeSchema.parse({
	delivery_id: '550e8400-e29b-41d4-a716-446655440014',
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
			secondBoardProp,
		],
		guilds: [
			{ guild_id: 'guild-1', channel_id: 'channel-1', sport: 'nba' },
		],
		boards: [
			{
				event_id: 'event-1',
				over_outcome_uuids: [
					'550e8400-e29b-41d4-a716-446655440005',
					'550e8400-e29b-41d4-a716-446655440015',
				],
			},
		],
	},
})

const h2hEnvelope = deliveryEnvelopeSchema.parse({
	delivery_id: '550e8400-e29b-41d4-a716-446655440007',
	schema_version: 1,
	kind: 'h2h_result',
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: {
		user_id: 'user-h2h',
		bet_id: 7,
		event_id: 'event-h2h',
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440008',
		result: 'won',
		team: 'Home',
		stake: 10,
		payout: 25,
		profit: 15,
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

	it('derives one H2H DM destination and dispatches it', async () => {
		const store = new RedisDeliveryStore(fakeRedis())
		const dispatcher: DeliveryDispatcher = {
			deliver: vi.fn(async () => ({ ok: true })),
		}
		queue = new NotificationDeliveryQueue({
			store,
			dispatcher,
			queue: {
				add: vi.fn(async () => undefined),
				close: vi.fn(async () => undefined),
			},
			startWorker: false,
		})

		await queue.accept(h2hEnvelope)
		await queue.processJob({ data: h2hEnvelope } as never)

		expect(dispatcher.deliver).toHaveBeenCalledWith(
			h2hEnvelope,
			'dm:user-h2h',
		)
		expect(
			(await store.get(h2hEnvelope.delivery_id))?.destinations,
		).toHaveLength(1)
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
	it('routes a system board delivery to fake-discord once for all pairs', async () => {
		const fetchMock = vi.fn<typeof fetch>(
			async () =>
				new Response(JSON.stringify({ id: 'fake-board-1' }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				}),
		)
		vi.stubGlobal('fetch', fetchMock)

		const receipt = (await new SystemDiscordDeliveryDispatcher().deliver(
			boardEnvelope,
			'prop-board:guild-1:channel-1:0',
		)) as Array<{ message_id: string }>

		expect(fetchMock).toHaveBeenCalledOnce()
		expect(receipt).toHaveLength(4)
		expect(new Set(receipt.map((ref) => ref.message_id))).toEqual(
			new Set(['fake-board-1']),
		)
		const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
			props: unknown[]
		}
		expect(body.props).toHaveLength(2)
	})

	describe('board game blocks', () => {
		const away = '660e8400-e29b-41d4-a716-446655440010'
		const home = '660e8400-e29b-41d4-a716-446655440011'
		const gameEnvelope = deliveryEnvelopeSchema.parse({
			...boardEnvelope,
			delivery_id: '550e8400-e29b-41d4-a716-446655440099',
			payload: {
				...boardEnvelope.payload,
				boards: (
					boardEnvelope.payload as { boards: Array<object> }
				).boards.map((board, index) =>
					index === 0
						? {
								...board,
								game: {
									h2h: {
										away: {
											outcome_uuid: away,
											outcome_name: 'Away',
											price: 150,
										},
										home: {
											outcome_uuid: home,
											outcome_name: 'Home',
											price: -180,
										},
									},
								},
							}
						: board,
				),
			},
		})

		it('keeps the game block through payload validation', () => {
			expect(
				(gameEnvelope.payload as { boards: Array<{ game?: unknown }> })
					.boards[0].game,
			).toBeDefined()
		})

		it('delivers a board with game receipts, and one without them', async () => {
			const fetchMock = vi.fn<typeof fetch>(
				async () =>
					new Response(JSON.stringify({ id: 'fake-board-2' }), {
						status: 200,
						headers: { 'content-type': 'application/json' },
					}),
			)
			vi.stubGlobal('fetch', fetchMock)
			const withGame =
				(await new SystemDiscordDeliveryDispatcher().deliver(
					gameEnvelope,
					'prop-board:guild-1:channel-1:0',
				)) as Array<{ outcome_uuid: string }>
			expect(withGame.map((ref) => ref.outcome_uuid)).toEqual(
				expect.arrayContaining([away, home]),
			)
			expect(withGame).toHaveLength(6)

			for (const receipts of [withGame, withGame.slice(0, 4)]) {
				const store = new RedisDeliveryStore(fakeRedis())
				queue = new NotificationDeliveryQueue({
					store,
					dispatcher: { deliver: vi.fn(async () => receipts) },
					queue: {
						add: vi.fn(async () => undefined),
						close: vi.fn(async () => undefined),
					} satisfies DeliveryQueuePort,
					startWorker: false,
				})
				await queue.accept(gameEnvelope)
				await queue.processJob({ data: gameEnvelope } as never)
				expect((await store.get(gameEnvelope.delivery_id))?.state).toBe(
					'delivered',
				)
			}
		})
	})

	it('refuses a board destination that names a missing board', async () => {
		await expect(
			new SystemDiscordDeliveryDispatcher().deliver(
				boardEnvelope,
				'prop-board:guild-1:channel-1:9',
			),
		).rejects.toMatchObject({ status: 422 })
	})

	it('posts one board destination and records a receipt for every pair', async () => {
		const redis = fakeRedis()
		const store = new RedisDeliveryStore(redis)
		const receipts = [
			'550e8400-e29b-41d4-a716-446655440005',
			'550e8400-e29b-41d4-a716-446655440006',
			'550e8400-e29b-41d4-a716-446655440015',
			'550e8400-e29b-41d4-a716-446655440016',
		].map((outcome_uuid) => ({
			outcome_uuid,
			guild_id: 'guild-1',
			channel_id: 'channel-1',
			message_id: 'board-message-1',
		}))
		const dispatcher: DeliveryDispatcher = {
			deliver: vi.fn(async () => receipts),
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

		expect(destinationIds(boardEnvelope)).toEqual([
			'prop-board:guild-1:channel-1:0',
		])

		await queue.accept(boardEnvelope)
		await queue.processJob({ data: boardEnvelope } as never)

		const record = await store.get(boardEnvelope.delivery_id)
		expect(record?.state).toBe('delivered')
		expect(dispatcher.deliver).toHaveBeenCalledTimes(1)
		expect(record?.destinations[0].receipt).toHaveLength(4)
	})

	it('re-posts a board whose recorded receipt is incomplete', async () => {
		const redis = fakeRedis()
		const store = new RedisDeliveryStore(redis)
		const pairReceipts = [
			'550e8400-e29b-41d4-a716-446655440005',
			'550e8400-e29b-41d4-a716-446655440006',
		].map((outcome_uuid) => ({
			outcome_uuid,
			guild_id: 'guild-1',
			channel_id: 'channel-1',
			message_id: 'board-message-1',
		}))
		const allReceipts = [
			...pairReceipts,
			{
				outcome_uuid: '550e8400-e29b-41d4-a716-446655440015',
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'board-message-1',
			},
			{
				outcome_uuid: '550e8400-e29b-41d4-a716-446655440016',
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'board-message-1',
			},
		]
		let calls = 0
		const dispatcher: DeliveryDispatcher = {
			deliver: vi.fn(async () => {
				calls++
				return calls === 1 ? pairReceipts : allReceipts
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

		await queue.accept(boardEnvelope)
		await expect(
			queue.processJob({ data: boardEnvelope } as never),
		).rejects.toThrow(/retry/)
		await queue.processJob({ data: boardEnvelope } as never)

		const record = await store.get(boardEnvelope.delivery_id)
		expect(record?.state).toBe('delivered')
		expect(dispatcher.deliver).toHaveBeenCalledTimes(2)
		expect(record?.destinations[0].receipt).toHaveLength(4)
	})
})
