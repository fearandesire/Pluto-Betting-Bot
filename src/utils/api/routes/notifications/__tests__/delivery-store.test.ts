import { describe, expect, it } from 'vitest'
import type { RedisCacheClient } from '../../../../cache/redis-instance.js'
import {
	classifyDeliveryError,
	deliveryEnvelopeSchema,
} from '../delivery-contract.js'
import { deriveDeliveryState, RedisDeliveryStore } from '../delivery-store.js'

const envelope = {
	delivery_id: '550e8400-e29b-41d4-a716-446655440000',
	schema_version: 1 as const,
	kind: 'prop_settled' as const,
	occurred_at: '2026-07-14T20:00:00.000Z',
	payload: {
		outcome_uuid: '550e8400-e29b-41d4-a716-446655440001',
		result: 'won' as const,
		winning_side_display: 'Over',
		actual_value: 37,
		market_key: 'player_points',
		description: 'Stephen Curry',
		point: 35.5,
		tallies: { correct: 1, incorrect: 0, total: 1 },
		messages: [
			{
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				message_id: 'message-1',
			},
		],
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

describe('durable notification delivery contract', () => {
	it('accepts once, deduplicates same payload, and rejects changed payload', async () => {
		const parsed = deliveryEnvelopeSchema.parse(envelope)
		const store = new RedisDeliveryStore(fakeRedis())

		expect((await store.accept(parsed)).kind).toBe('accepted')
		expect((await store.accept(parsed)).kind).toBe('duplicate')

		const changed = deliveryEnvelopeSchema.parse({
			...parsed,
			payload: { ...parsed.payload, actual_value: 38 },
		})
		expect((await store.accept(changed)).kind).toBe('conflict')
	})

	it('classifies permanent Discord destinations without retrying forever', () => {
		expect(
			classifyDeliveryError(
				Object.assign(new Error('blocked'), { code: 50007 }),
			),
		).toMatchObject({
			classification: 'permanent',
		})
		expect(classifyDeliveryError(new Error('timeout'))).toMatchObject({
			classification: 'transient',
		})
	})

	it('derives delivered and permanent terminal states from destinations', async () => {
		const record = (
			await new RedisDeliveryStore(fakeRedis()).accept(
				deliveryEnvelopeSchema.parse(envelope),
			)
		).record
		record.destinations[0].state = 'delivered'
		expect(deriveDeliveryState(record)).toBe('delivered')
		record.destinations[0].state = 'permanent_failed'
		expect(deriveDeliveryState(record)).toBe('permanent_failed')
	})
})
