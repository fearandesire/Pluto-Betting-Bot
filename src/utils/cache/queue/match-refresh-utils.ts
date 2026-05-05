/**
 * Pure helpers for match-refresh queue. Isolated so they can be unit-tested
 * without loading Redis/env/API dependencies.
 */

// BullMQ throws this exact format when adding a job whose jobId is already
// present in the queue: `Job ${jobId} already exists`. Match that shape
// specifically rather than a loose substring check so we don't swallow
// unrelated errors that happen to contain both words.
const DUPLICATE_JOB_PATTERN = /^Job\s+\S+\s+already exists$/

export function isDuplicateJobError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error)
	return DUPLICATE_JOB_PATTERN.test(message)
}
