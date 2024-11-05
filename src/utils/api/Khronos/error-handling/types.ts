import { ResponseError } from '@khronos-index';
import { ApiHttpErrorTypes } from '../../../../lib/interfaces/api/api.interface.js';

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
	exception: string;
	message: string;
	details?: Record<string, unknown>;
	response?: Response;
}

/**
 * Type guard to check if an unknown error matches the KhronosApiError shape
 */
export function isKhronosApiError(error: unknown): error is KhronosApiError {
	if (!error || typeof error !== 'object') return false;

	const errorObj = error as Record<string, unknown>;

	return (
		'exception' in errorObj &&
		typeof errorObj.exception === 'string' &&
		'message' in errorObj &&
		typeof errorObj.message === 'string'
	);
}

/**
 * Converts an unknown error into a KhronosApiError
 * If it's a ResponseError, extracts the API error data
 * Otherwise creates a standardized internal error
 */
export async function toKhronosApiError(
	error: unknown,
): Promise<KhronosApiError> {
	try {
		// Handle ResponseError from API
		if (error instanceof ResponseError) {
			const errorData = await error.response.json();

			// Check if parsed response is a valid KhronosApiError
			if (isKhronosApiError(errorData)) {
				return {
					...errorData,
				};
			}
		}

		// Handle pre-parsed KhronosApiError instances
		if (isKhronosApiError(error)) {
			return error;
		}

		// Create a default internal error for all other cases
		return {
			exception: ApiHttpErrorTypes.InternalError,
			message: error instanceof Error ? error.message : String(error),
			details: {
				originalError: error,
				errorType:
					error instanceof Error ? error.constructor.name : typeof error,
			},
		};
	} catch (conversionError) {
		// Handle errors during conversion process
		return {
			exception: ApiHttpErrorTypes.InternalError,
			message: 'Error while processing API error response',
			details: {
				originalError: error,
				conversionError,
			},
		};
	}
}
