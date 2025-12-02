/**
 * API Error Types for service layer
 * Provides typed errors for different failure scenarios
 */

/**
 * Categories of API errors for differentiated handling
 */
export enum ApiErrorCategory {
	/** Network-level failures (DNS, connection refused, timeout) */
	Network = 'NETWORK',
	/** HTTP 4xx client errors (bad request, unauthorized, not found) */
	ClientError = 'CLIENT_ERROR',
	/** HTTP 5xx server errors (internal error, bad gateway, service unavailable) */
	ServerError = 'SERVER_ERROR',
	/** Rate limiting (HTTP 429) */
	RateLimited = 'RATE_LIMITED',
	/** Unknown/unclassified errors */
	Unknown = 'UNKNOWN',
}

/**
 * Metadata extracted from HTTP responses when available
 */
export interface HttpErrorMetadata {
	status: number | null
	statusText: string | null
	data: unknown
	headers: Record<string, string> | null
	retryAfter: number | null
}

/**
 * Typed API error with full context for logging and handling
 */
export class ApiServiceError extends Error {
	readonly category: ApiErrorCategory
	readonly httpMetadata: HttpErrorMetadata | null
	readonly isRetriable: boolean
	readonly originalError: Error | null
	readonly source: string

	constructor(options: {
		message: string
		category: ApiErrorCategory
		httpMetadata?: HttpErrorMetadata | null
		isRetriable?: boolean
		originalError?: Error | null
		source: string
	}) {
		super(options.message)
		this.name = 'ApiServiceError'
		this.category = options.category
		this.httpMetadata = options.httpMetadata ?? null
		this.isRetriable = options.isRetriable ?? false
		this.originalError = options.originalError ?? null
		this.source = options.source
	}

	/**
	 * Creates a structured object for logging
	 */
	toLogMetadata(): Record<string, unknown> {
		return {
			errorName: this.name,
			errorMessage: this.message,
			category: this.category,
			isRetriable: this.isRetriable,
			source: this.source,
			httpStatus: this.httpMetadata?.status ?? null,
			httpStatusText: this.httpMetadata?.statusText ?? null,
			httpData: this.httpMetadata?.data ?? null,
			httpHeaders: this.httpMetadata?.headers ?? null,
			retryAfter: this.httpMetadata?.retryAfter ?? null,
			originalError: this.originalError
				? {
						name: this.originalError.name,
						message: this.originalError.message,
						stack: this.originalError.stack,
					}
				: null,
		}
	}
}

/**
 * Result type for operations that can fail
 * Allows callers to handle success/failure explicitly
 */
export type Result<T, E = ApiServiceError> =
	| { success: true; data: T }
	| { success: false; error: E }

/**
 * Helper to create a success result
 */
export function ok<T>(data: T): Result<T, never> {
	return { success: true, data }
}

/**
 * Helper to create a failure result
 */
export function err<E>(error: E): Result<never, E> {
	return { success: false, error }
}
