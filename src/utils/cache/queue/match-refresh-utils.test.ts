import { describe, expect, it } from 'vitest'
import { isDuplicateJobError } from './match-refresh-utils.js'

describe('match-refresh-utils', () => {
	describe('isDuplicateJobError', () => {
		it('returns true for BullMQ duplicate job message', () => {
			expect(
				isDuplicateJobError(
					new Error('Job refresh-123 already exists'),
				),
			).toBe(true)
			expect(
				isDuplicateJobError(new Error('Job initial already exists')),
			).toBe(true)
		})

		it('returns false for other errors', () => {
			expect(isDuplicateJobError(new Error('Connection refused'))).toBe(
				false,
			)
			expect(isDuplicateJobError(new Error('No matches returned'))).toBe(
				false,
			)
		})

		it('returns false for unrelated errors that mention "job" and "already exists"', () => {
			// Previously the loose substring check matched any message
			// containing both words. The tightened regex now requires
			// BullMQ's exact "Job <id> already exists" format.
			expect(
				isDuplicateJobError(
					new Error('the job entry already exists in the database'),
				),
			).toBe(false)
			expect(isDuplicateJobError(new Error('job already exists'))).toBe(
				false,
			)
		})

		it('handles non-Error values', () => {
			expect(isDuplicateJobError('Job xyz already exists')).toBe(true)
			expect(isDuplicateJobError('random string')).toBe(false)
		})
	})
})
