export interface SafeUserError {
	code: 'REQUEST_ERROR' | 'TEMPORARY_UNAVAILABLE' | 'INTERNAL_SERVER_ERROR'
	message: string
	status: 400 | 503 | 500
	correlationId?: string
}

export function toSafeUserError(
	error: unknown,
	correlationId?: string,
): SafeUserError {
	const candidate = error as { status?: unknown; statusCode?: unknown }
	const status = Number(candidate?.statusCode ?? candidate?.status)
	const isTemporary =
		status === 408 || status === 425 || status === 429 || status >= 500
	const result: SafeUserError = isTemporary
		? {
				code: 'TEMPORARY_UNAVAILABLE',
				message:
					'The service is temporarily unavailable. Please try again later.',
				status: 503,
			}
		: {
				code:
					status >= 400 && status < 500
						? 'REQUEST_ERROR'
						: 'INTERNAL_SERVER_ERROR',
				message:
					status >= 400 && status < 500
						? 'The request could not be processed. Check the provided values and try again.'
						: 'Something went wrong while processing your request. Please try again later.',
				status: status >= 400 && status < 500 ? 400 : 500,
			}
	if (correlationId) result.correlationId = correlationId
	return result
}
