import type { RedisCacheClient } from '../../../cache/redis-instance.js'
import {
	type DeliveryEnvelope,
	type DeliveryRecord,
	type DeliveryState,
	deliveryPayloadHash,
	destinationIds,
} from './delivery-contract.js'

const KEY_PREFIX = 'pluto:delivery:v1:'
const RETENTION_SECONDS = 180 * 24 * 60 * 60

export type AcceptDeliveryResult =
	| { kind: 'accepted'; record: DeliveryRecord }
	| { kind: 'duplicate'; record: DeliveryRecord }
	| { kind: 'conflict'; record: DeliveryRecord }

export interface DeliveryStore {
	accept(envelope: DeliveryEnvelope): Promise<AcceptDeliveryResult>
	get(deliveryId: string): Promise<DeliveryRecord | null>
	update(
		deliveryId: string,
		update: (record: DeliveryRecord) => DeliveryRecord,
	): Promise<DeliveryRecord>
}

function key(deliveryId: string): string {
	return `${KEY_PREFIX}${deliveryId}`
}

function parseRecord(raw: string | null): DeliveryRecord | null {
	if (!raw) return null
	try {
		const parsed = JSON.parse(raw) as DeliveryRecord
		if (
			typeof parsed.delivery_id !== 'string' ||
			typeof parsed.payload_hash !== 'string' ||
			!Array.isArray(parsed.destinations)
		)
			return null
		return parsed
	} catch {
		return null
	}
}

export class RedisDeliveryStore implements DeliveryStore {
	private redis?: RedisCacheClient

	constructor(redis?: RedisCacheClient) {
		this.redis = redis
	}

	private async client(): Promise<RedisCacheClient> {
		if (!this.redis) {
			// Defer env validation/Redis connection until a delivery route is
			// actually used. This keeps route and contract tests hermetic.
			this.redis = (
				await import('../../../cache/redis-instance.js')
			).default
		}
		return this.redis
	}

	async accept(envelope: DeliveryEnvelope): Promise<AcceptDeliveryResult> {
		const deliveryKey = key(envelope.delivery_id)
		const payloadHash = deliveryPayloadHash(envelope)
		const now = new Date().toISOString()
		const record: DeliveryRecord = {
			delivery_id: envelope.delivery_id,
			kind: envelope.kind,
			schema_version: 1,
			occurred_at: envelope.occurred_at,
			payload: envelope.payload,
			payload_hash: payloadHash,
			state: 'queued',
			attempts: 0,
			destinations: destinationIds(envelope).map((id) => ({
				id,
				state: 'queued',
				attempts: 0,
			})),
			created_at: now,
			updated_at: now,
		}

		const redis = await this.client()
		const created = await redis.set(
			deliveryKey,
			JSON.stringify(record),
			'NX',
			'EX',
			RETENTION_SECONDS,
		)
		if (created === 'OK') return { kind: 'accepted', record }

		const existing = await this.get(envelope.delivery_id)
		if (!existing) {
			// A malformed record must never be overwritten by a callback. Treat it
			// as a conflict so operators can inspect and repair it explicitly.
			return { kind: 'conflict', record }
		}
		return existing.payload_hash === payloadHash
			? { kind: 'duplicate', record: existing }
			: { kind: 'conflict', record: existing }
	}

	async get(deliveryId: string): Promise<DeliveryRecord | null> {
		return parseRecord(await (await this.client()).get(key(deliveryId)))
	}

	async update(
		deliveryId: string,
		mutate: (record: DeliveryRecord) => DeliveryRecord,
	): Promise<DeliveryRecord> {
		const existing = await this.get(deliveryId)
		if (!existing) throw new Error(`Delivery ${deliveryId} not found`)
		const next = mutate(existing)
		next.updated_at = new Date().toISOString()
		await (await this.client()).set(
			key(deliveryId),
			JSON.stringify(next),
			'EX',
			RETENTION_SECONDS,
		)
		return next
	}
}

export function deriveDeliveryState(record: DeliveryRecord): DeliveryState {
	const states = record.destinations.map((destination) => destination.state)
	if (states.every((state) => state === 'delivered')) return 'delivered'
	if (states.some((state) => state === 'processing')) return 'processing'
	if (states.some((state) => state === 'retryable_failed')) {
		return 'retryable_failed'
	}
	if (states.every((state) => state === 'permanent_failed')) {
		return 'permanent_failed'
	}
	if (states.some((state) => state === 'permanent_failed')) {
		return states.every(
			(state) => state === 'delivered' || state === 'permanent_failed',
		)
			? 'permanent_failed'
			: 'processing'
	}
	return 'queued'
}
