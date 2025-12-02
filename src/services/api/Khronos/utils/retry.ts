/**
 * Retry utilities with exponential backoff for API calls
 *
 * Builds on existing error handling from utils/api/Khronos/error-handling/
 */

import { ResponseError } from '@khronos-index'
import {
	type KhronosApiError,
	toKhronosApiError,
} from '../../../../utils/api/Khronos/error-handling/types.js'
import {
	ApiErrorCategory,
	ApiServiceError,
	type HttpErrorMetadata,
} from '../types/api-errors.js'

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
	/** Maximum number of retry attempts (default: 3) */
	maxRetries: number
	/** Base delay in milliseconds (default: 1000) */
	baseDelayMs: number
	/** Maximum delay cap in milliseconds (default: 30000) */
	maxDelayMs: number
	/** Jitter factor 0-1 to randomize delays (default: 0.1) */
	jitterFactor: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
	jitterFactor: 0.1,
}

/**
 * Network error patterns that indicate transient failures
 */
const NETWORK_ERROR_PATTERNS = [
	'ECONNREFUSED',
	'ECONNRESET',
	'ETIMEDOUT',
	'ENOTFOUND',
	'EAI_AGAIN',
	'EPIPE',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'socket hang up',
	'network error',
	'fetch failed',
	'aborted',
]

/**
 * Checks if an error message indicates a network-level failure
 */
function isNetworkErrorMessage(message: string): boolean {
	const lowerMessage = message.toLowerCase()
	return NETWORK_ERROR_PATTERNS.some(
		(pattern) =>
			lowerMessage.includes(pattern.toLowerCase()) ||
			message.includes(pattern),
	)
}

/**
 * Extracts HTTP metadata from a Response object
 */
function extractHttpMetadata(response: Response): HttpErrorMetadata {
	const headers: Record<string, string> = {}
	response.headers.forEach((value, key) => {
		headers[key] = value
	})

	// Parse Retry-After header (can be seconds or HTTP-date)
	let retryAfter: number | null = null
	const retryAfterHeader = response.headers.get('retry-after')
	if (retryAfterHeader) {
		const seconds = Number.parseInt(retryAfterHeader, 10)
		if (!Number.isNaN(seconds)) {
			retryAfter = seconds * 1000 // Convert to milliseconds
		} else {
			// Try parsing as HTTP-date
			const date = Date.parse(retryAfterHeader)
			if (!Number.isNaN(date)) {
				retryAfter = Math.max(0, date - Date.now())
			}
		}
	}

	return {
		status: response.status,
		statusText: response.statusText,
		data: null, // Will be populated by caller if needed
		headers,
		retryAfter,
	}
}

/**
 * Type guard for ResponseError
 */
function isResponseError(error: unknown): error is ResponseError {
	return error instanceof ResponseError
}

/**
 * Classifies an error into a category for handling
 */
export function classifyError(
	error: unknown,
	source: string,
): { category: ApiErrorCategory; metadata: HttpErrorMetadata | null } {
	// Handle ResponseError from OpenAPI client
	if (isResponseError(error)) {
		const status = error.response.status
		const metadata = extractHttpMetadata(error.response)

		if (status === 429) {
			return { category: ApiErrorCategory.RateLimited, metadata }
		}
		if (status >= 500) {
			return { category: ApiErrorCategory.ServerError, metadata }
		}
		if (status >= 400) {
			return { category: ApiErrorCategory.ClientError, metadata }
		}
		return { category: ApiErrorCategory.Unknown, metadata }
	}

	// Handle standard Error objects
	if (error instanceof Error) {
		if (isNetworkErrorMessage(error.message)) {
			return { category: ApiErrorCategory.Network, metadata: null }
		}
	}

	return { category: ApiErrorCategory.Unknown, metadata: null }
}

/**
 * Determines if an error category is retriable
 */
export function isRetriableCategory(category: ApiErrorCategory): boolean {
	return (
		category === ApiErrorCategory.Network ||
		category === ApiErrorCategory.ServerError ||
		category === ApiErrorCategory.RateLimited
	)
}

/**
 * Calculates delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(
	attempt: number,
	config: RetryConfig,
	retryAfterMs?: number | null,
): number {
	// Honor Retry-After header if present
	if (retryAfterMs && retryAfterMs > 0) {
		return Math.min(retryAfterMs, config.maxDelayMs)
	}

	// Exponential backoff: baseDelay * 2^attempt
	const exponentialDelay = config.baseDelayMs * 2 ** attempt

	// Add jitter to prevent thundering herd
	const jitter = exponentialDelay * config.jitterFactor * Math.random()
	const delayWithJitter = exponentialDelay + jitter

	return Math.min(delayWithJitter, config.maxDelayMs)
}

/**
 * Sleeps for the specified duration
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates an ApiServiceError from a caught error
 * Leverages existing toKhronosApiError for consistent error parsing
 */
export async function createApiServiceError(
	error: unknown,
	source: string,
): Promise<ApiServiceError> {
	const { category, metadata } = classifyError(error, source)
	const isRetriable = isRetriableCategory(category)

	// Use existing error parser for consistent message extraction
	const khronosError = await toKhronosApiError(error)
	let httpMetadata = metadata

	// Enrich metadata with parsed response data
	if (isResponseError(error) && httpMetadata) {
		try {
			const data = await error.response.clone().json()
			httpMetadata = { ...httpMetadata, data }
		} catch {
			// Response body not JSON-parseable, leave data as null
		}
	}

	return new ApiServiceError({
		message: khronosError.message,
		category,
		httpMetadata,
		isRetriable,
		originalError: error instanceof Error ? error : null,
		source,
	})
}

/**
 * Executes an async function with retry logic and exponential backoff
 *
 * @param fn - The async function to execute
 * @param source - Source identifier for logging
 * @param config - Retry configuration (optional)
 * @returns The result of the function or throws ApiServiceError
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	source: string,
	config: Partial<RetryConfig> = {},
): Promise<T> {
	const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
	let lastError: ApiServiceError | null = null

	for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = await createApiServiceError(error, source)

			// Don't retry non-retriable errors (4xx client errors)
			if (!lastError.isRetriable) {
				throw lastError
			}

			// Don't retry if we've exhausted attempts
			if (attempt >= fullConfig.maxRetries) {
				break
			}

			// Calculate delay, honoring Retry-After for rate limits
			const delay = calculateBackoffDelay(
				attempt,
				fullConfig,
				lastError.httpMetadata?.retryAfter,
			)

			await sleep(delay)
		}
	}

	// Exhausted all retries
	throw lastError!
}
