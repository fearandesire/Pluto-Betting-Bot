import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RedisCacheClient } from '../../../../cache/redis-instance.js'
import { deliveryEnvelopeSchema } from '../delivery-contract.js'
import {
	type DeliveryDispatcher,
	type DeliveryQueuePort,
	NotificationDeliveryQueue,
} from '../delivery-queue.js'
import { RedisDeliveryStore } from '../delivery-store.js'
import NotificationService from '../notifications.service.js'

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const discord = vi.hoisted(() => ({
	client: {
		users: {
			fetch: vi.fn(),
			send: vi.fn(),
		},
	},
}))

vi.mock('@sapphire/framework', () => ({ container: discord }))

const h2hEnvelope = deliveryEnvelopeSchema.parse({
	delivery_id: '550e8400-e29b-41d4-a716-446655440030',
	schema_version: 1,
	kind: 'h2h_result',
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: {
		user_id: 'user-h2h',
		bet_id: 7,
		event_id: 'event-h2h',
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440031',
		result: 'lost',
		team: 'Home',
		stake: 10,
		payout: 0,
		profit: -10,
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

describe('durable H2H notification delivery', () => {
	let user: { send: ReturnType<typeof vi.fn> }

	beforeEach(() => {
		vi.clearAllMocks()
		user = { send: vi.fn().mockResolvedValue(undefined) }
		discord.client.users.fetch.mockResolvedValue(user)
		discord.client.users.send.mockResolvedValue(undefined)
	})

	it('renders the formatted stake for won and lost results', async () => {
		const service = new NotificationService()

		for (const result of ['won', 'lost'] as const) {
			user.send.mockClear()
			await service.deliverH2hResult(
				{
					...h2hEnvelope.payload,
					result,
					payout: result === 'won' ? 25 : 0,
					profit: result === 'won' ? 15 : -10,
				},
				`delivery-${result}`,
			)

			expect(user.send).toHaveBeenCalledWith(
				expect.objectContaining({
					embeds: [
						expect.objectContaining({
							data: expect.objectContaining({
								fields: expect.arrayContaining([
									{
										name: '💰 Bet Amount',
										value: '$10.00',
										inline: true,
									},
								]),
							}),
						}),
					],
				}),
			)
		}
	})

	it('retries a lost result when Discord rejects and uses a stable nonce on success', async () => {
		const service = new NotificationService()
		const store = new RedisDeliveryStore(fakeRedis())
		const dispatcher: DeliveryDispatcher = {
			deliver: vi.fn(async (envelope) => {
				if (envelope.kind !== 'h2h_result')
					throw new Error('Unexpected kind')
				await service.deliverH2hResult(
					envelope.payload,
					envelope.delivery_id,
				)
			}),
		}
		const queue = new NotificationDeliveryQueue({
			store,
			dispatcher,
			queue: {
				add: vi.fn(async () => undefined),
				close: vi.fn(async () => undefined),
			} satisfies DeliveryQueuePort,
			startWorker: false,
		})

		await service.deliverH2hResult(
			h2hEnvelope.payload,
			h2hEnvelope.delivery_id,
		)
		const successfulMessage = user.send.mock.calls[0]?.[0]
		expect(successfulMessage).toEqual(
			expect.objectContaining({
				nonce: expect.any(String),
				enforceNonce: true,
			}),
		)

		user.send.mockRejectedValueOnce(new Error('Discord send failed'))
		await queue.accept(h2hEnvelope)
		await expect(
			queue.processJob({ data: h2hEnvelope } as never),
		).rejects.toThrow(/retry/)
		expect((await store.get(h2hEnvelope.delivery_id))?.state).toBe(
			'retryable_failed',
		)

		await queue.close()
	})
})
