import { describe, expect, it } from 'vitest'
import { isDuplicateJobError } from './match-refresh-utils.js'

describe('match-refresh-queue', () => {
	describe('isDuplicateJobError', () => {
		it('returns true for BullMQ duplicate job message', () => {
			expect(
				isDuplicateJobError(
					new Error('Job refresh-123 already exists'),
				),
			).toBe(true)
			expect(isDuplicateJobError(new Error('job already exists'))).toBe(
				true,
			)
		})

		it('returns false for other errors', () => {
			expect(isDuplicateJobError(new Error('Connection refused'))).toBe(
				false,
			)
			expect(isDuplicateJobError(new Error('No matches returned'))).toBe(
				false,
			)
		})

		it('handles non-Error values', () => {
			expect(isDuplicateJobError('Job xyz already exists')).toBe(true)
			expect(isDuplicateJobError('random string')).toBe(false)
		})
	})
})
