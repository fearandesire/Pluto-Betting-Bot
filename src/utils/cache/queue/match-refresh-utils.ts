/**
 * Pure helpers for match-refresh queue. Isolated so they can be unit-tested
 * without loading Redis/env/API dependencies.
 */

export function isDuplicateJobError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error)
	return (
		message.toLowerCase().includes('job') &&
		message.toLowerCase().includes('already exists')
	)
}
