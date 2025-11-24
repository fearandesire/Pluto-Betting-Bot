import { ResponseError } from '@khronos-index'
import { ApiHttpErrorTypes } from '../../../../lib/interfaces/api/api.interface.js'

/**
 * Represents an error response from the Khronos API
 * @interface KhronosApiError
 *
 * @property {string} exception - The type of error that occurred (e.g., 'InsufficientBalance', 'ValidationError')
 * @property {string} message - A human-readable description of the error
 * @property {Record<string, unknown>} [details] - Optional additional context about the error.
 * May include specific error details like balance amounts, validation errors, or other metadata
 * @property {Response} [response] - Optional raw Response object from the fetch request.
 * Present when the error occurs during an HTTP request
 *
 * @example
 * ```typescript
 * const error: KhronosApiError = {
 *   exception: 'InsufficientBalance',
 *   message: 'Not enough funds to place bet',
 *   details: { balance: 100.50 }
 * };
 * ```
 */
export interface KhronosApiError {
	exception: string
	message: string
	details?: Record<string, unknown>
	response?: Response
}

/**
 * Type guard to check if an unknown error matches the KhronosApiError shape
 */
export function isKhronosApiError(error: unknown): error is KhronosApiError {
	if (!error || typeof error !== 'object') return false

	const errorObj = error as Record<string, unknown>

	return (
		'exception' in errorObj &&
		typeof errorObj.exception === 'string' &&
		'message' in errorObj &&
		typeof errorObj.message === 'string'
	)
}

/**
 * Converts an unknown error into a KhronosApiError
 * If it's a ResponseError, extracts the API error data
 * Otherwise creates a standardized internal error
 *
 * Note: This intentionally does NOT include originalError in details
 * to prevent leaking internal errors to users
 */
export async function toKhronosApiError(
	error: unknown,
): Promise<KhronosApiError> {
	try {
		// Handle plain strings (e.g., 'Failed to create account.')
		if (typeof error === 'string') {
			return {
				exception: ApiHttpErrorTypes.InternalError,
				message: error,
			}
		}

		// Handle ResponseError from API
		if (error instanceof ResponseError) {
			try {
				const errorData = await error.response.json()

				// Check if parsed response is a valid KhronosApiError
				if (isKhronosApiError(errorData)) {
					return {
						exception: errorData.exception,
						message: errorData.message,
						details: errorData.details,
					}
				}

				// JSON parsed but doesn't match KhronosApiError shape
				// Still return with HTTP status to preserve context
				return {
					exception: ApiHttpErrorTypes.InternalError,
					message: `Request failed with status ${error.response.status}`,
				}
			} catch {
				// JSON parsing failed, create a generic error
				return {
					exception: ApiHttpErrorTypes.InternalError,
					message: `Request failed with status ${error.response.status}`,
				}
			}
		}

		// Handle pre-parsed KhronosApiError instances
		if (isKhronosApiError(error)) {
			return {
				exception: error.exception,
				message: error.message,
				details: error.details,
			}
		}

		// Handle standard Error objects
		if (error instanceof Error) {
			// Log the full error internally but don't expose it
			console.error({
				source: 'toKhronosApiError',
				errorName: error.name,
				errorMessage: error.message,
				stack: error.stack,
			})

			return {
				exception: ApiHttpErrorTypes.InternalError,
				message: error.message,
			}
		}

		// Fallback for unknown error types
		console.error({
			source: 'toKhronosApiError',
			message: 'Unknown error type received',
			errorType: typeof error,
		})

		return {
			exception: ApiHttpErrorTypes.InternalError,
			message: 'An unexpected error occurred',
		}
	} catch (conversionError) {
		// Handle errors during conversion process
		console.error({
			source: 'toKhronosApiError',
			message: 'Error while processing API error',
			conversionError,
		})

		return {
			exception: ApiHttpErrorTypes.InternalError,
			message: 'Error while processing request',
		}
	}
}
