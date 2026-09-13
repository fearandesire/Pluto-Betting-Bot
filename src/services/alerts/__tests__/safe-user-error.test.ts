import { describe, expect, it } from 'vitest'
import { toSafeUserError } from '../safe-user-error.js'

describe('toSafeUserError', () => {
	it('returns neutral text when an internal error contains sensitive details', () => {
		const error = new Error('implementation detail with private data')

		const result = toSafeUserError(error, 'req-123')

		expect(result.message).toBe(
			'Something went wrong while processing your request. Please try again later.',
		)
		expect(result.message).not.toContain('implementation detail')
		expect(result.message).not.toContain('private')
		expect(result.correlationId).toBe('req-123')
	})

	it('maps retryable failures to a neutral temporary-unavailable response', () => {
		const error = Object.assign(
			new Error('Discord 429 Retry-After: 999999'),
			{
				status: 429,
			},
		)

		expect(toSafeUserError(error)).toEqual({
			code: 'TEMPORARY_UNAVAILABLE',
			message:
				'The service is temporarily unavailable. Please try again later.',
			status: 503,
		})
	})
})
