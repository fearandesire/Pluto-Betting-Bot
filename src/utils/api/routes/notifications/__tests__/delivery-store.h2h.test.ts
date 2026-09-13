import { describe, expect, it } from 'vitest'
import type { RedisCacheClient } from '../../../../cache/redis-instance.js'
import { deliveryEnvelopeSchema } from '../delivery-contract.js'
import { RedisDeliveryStore } from '../delivery-store.js'

const envelope = {
	delivery_id: '550e8400-e29b-41d4-a716-446655440010',
	schema_version: 1 as const,
	kind: 'h2h_result' as const,
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: {
		user_id: 'synthetic-user',
		guild_id: 'synthetic-guild',
		bet_id: 7,
		event_id: 'synthetic-event',
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440011',
		result: 'won' as const,
		team: 'Home',
		stake: 10,
		payout: 25,
		profit: 15,
	},
}

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

describe('H2H durable delivery contract', () => {
	it('accepts once, deduplicates replay, and rejects changed payloads', async () => {
		const parsed = deliveryEnvelopeSchema.parse(envelope)
		const store = new RedisDeliveryStore(fakeRedis())

		expect((await store.accept(parsed)).kind).toBe('accepted')
		expect((await store.accept(parsed)).kind).toBe('duplicate')
		expect(
			(
				await store.accept(
					deliveryEnvelopeSchema.parse({
						...parsed,
						payload: { ...parsed.payload, payout: 26 },
					}),
				)
			).kind,
		).toBe('conflict')
	})
})
