import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
	type PropSettledNotification,
	propSettledNotificationSchema,
} from '../shared-payload-schemas.js'
import {
	type ParlayResultNotification,
	parlayResultNotificationSchema,
} from './parlay-notification-contract.js'

export const deliveryKindSchema = z.enum(['parlay_result', 'prop_settled'])

const deliveryEnvelopeBaseSchema = z.object({
	delivery_id: z.string().uuid(),
	schema_version: z.literal(1),
	occurred_at: z.string().datetime({ offset: true }),
})

export const deliveryEnvelopeSchema = z.discriminatedUnion('kind', [
	deliveryEnvelopeBaseSchema.extend({
		kind: z.literal('parlay_result'),
		payload: parlayResultNotificationSchema,
	}),
	deliveryEnvelopeBaseSchema.extend({
		kind: z.literal('prop_settled'),
		payload: propSettledNotificationSchema,
	}),
])

export type DeliveryEnvelope = z.infer<typeof deliveryEnvelopeSchema>
export type DeliveryPayload = ParlayResultNotification | PropSettledNotification

export type DeliveryState =
	| 'queued'
	| 'processing'
	| 'delivered'
	| 'retryable_failed'
	| 'permanent_failed'

export type DestinationState =
	| 'queued'
	| 'processing'
	| 'delivered'
	| 'retryable_failed'
	| 'permanent_failed'

export interface DeliveryDestination {
	id: string
	state: DestinationState
	attempts: number
	last_error?: string
	classification?: 'transient' | 'permanent'
	receipt?: unknown
}

export interface DeliveryRecord {
	delivery_id: string
	kind: DeliveryEnvelope['kind']
	schema_version: 1
	occurred_at: string
	payload: DeliveryPayload
	payload_hash: string
	state: DeliveryState
	attempts: number
	destinations: DeliveryDestination[]
	created_at: string
	updated_at: string
	delivered_at?: string
}

/** Stable JSON is used so retried requests can compare semantic payloads. */
export function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
	if (value && typeof value === 'object') {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(
				([key, nested]) =>
					`${JSON.stringify(key)}:${stableJson(nested)}`,
			)
			.join(',')}}`
	}
	return JSON.stringify(value)
}

export function deliveryPayloadHash(envelope: DeliveryEnvelope): string {
	return createHash('sha256')
		.update(
			stableJson({
				schema_version: envelope.schema_version,
				kind: envelope.kind,
				occurred_at: envelope.occurred_at,
				payload: envelope.payload,
			}),
		)
		.digest('hex')
}

export function destinationIds(envelope: DeliveryEnvelope): string[] {
	if (envelope.kind === 'parlay_result') {
		return [`dm:${envelope.payload.user_id}`]
	}
	return [
		...new Set(
			envelope.payload.messages.map(
				(reference) =>
					`prop:${reference.guild_id}:${reference.channel_id}:${reference.message_id}`,
			),
		),
	]
}

export function classifyDeliveryError(error: unknown): {
	classification: 'transient' | 'permanent'
	message: string
} {
	const candidate = error as { code?: number | string; status?: number }
	const code = String(candidate?.code ?? '')
	const status = candidate?.status
	const permanentCodes = new Set(['50007', '10003', '50001', '10004'])
	const message = error instanceof Error ? error.message : String(error)
	return {
		classification:
			permanentCodes.has(code) ||
			(status !== undefined && status >= 400 && status < 500)
				? 'permanent'
				: 'transient',
		message: message.slice(0, 500),
	}
}
