import { describe, expect, it } from 'vitest'
import { boundedDeliveryRetryDelay } from '../delivery-queue.js'

describe('boundedDeliveryRetryDelay', () => {
	it('honors a valid Discord retry-after value within the cap', () => {
		expect(
			boundedDeliveryRetryDelay(1, {
				status: 429,
				retryAfterMs: 12_000,
			}),
		).toBe(12_000)
	})

	it('caps an excessive or untrusted retry-after value', () => {
		expect(
			boundedDeliveryRetryDelay(1, {
				status: 429,
				retryAfterMs: Number.MAX_SAFE_INTEGER,
			}),
		).toBe(60_000)
	})
})
