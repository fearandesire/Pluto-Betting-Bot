import { ResponseError } from '@khronos-index'

export interface RetryConfig {
	maxRetries: number
	baseDelayMs: number
	maxDelayMs: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export function extractRetryAfter(response: Response): number | null {
	const retryAfterHeader = response.headers.get('retry-after')
	if (!retryAfterHeader) return null

	const seconds = Number.parseInt(retryAfterHeader, 10)
	if (!Number.isNaN(seconds)) {
		return seconds * 1000
	}

	const date = Date.parse(retryAfterHeader)
	if (!Number.isNaN(date)) {
		return Math.max(0, date - Date.now())
	}

	return null
}

export function isRetriableError(error: unknown): boolean {
	if (error instanceof ResponseError) {
		const status = error.response.status
		return status === 429 || status >= 500
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase()
		return (
			message.includes('econnrefused') ||
			message.includes('econnreset') ||
			message.includes('etimedout') ||
			message.includes('enotfound') ||
			message.includes('network error') ||
			message.includes('fetch failed') ||
			message.includes('socket hang up') ||
			message.includes('timeout')
		)
	}

	return false
}
