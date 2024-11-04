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
 * @param error - The error to check
 * @returns Whether the error matches the KhronosApiError shape
 */
export function isKhronosApiError(error: unknown): error is KhronosApiError {
	if (!error || typeof error !== 'object') return false;

	// Check if it's a response error first
	if ('response' in error) {
		return true;
	}

	// Check for required KhronosApiError properties
	return (
		'exception' in error &&
		typeof (error as KhronosApiError).exception === 'string' &&
		'message' in error &&
		typeof (error as KhronosApiError).message === 'string'
	);
}

/**
 * Converts an unknown error into a KhronosApiError
 * Preserves the original error as the cause
 */
export async function toKhronosApiError(
	error: unknown,
): Promise<KhronosApiError> {
	// If it's already a KhronosApiError, return it
	if (isKhronosApiError(error)) {
		return error;
	}

	// If it's a Response object, try to parse it
	if (error instanceof Response) {
		try {
			const errorData = await error.json();
			if (isKhronosApiError(errorData)) {
				return errorData;
			}
		} catch {
			// Fall through to default error
		}
	}

	// Create a default error
	return {
		exception: ApiHttpErrorTypes.InternalError,
		message: error instanceof Error ? error.message : String(error),
		details: { originalError: error },
	};
}
