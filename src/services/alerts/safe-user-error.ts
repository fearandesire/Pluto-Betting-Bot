export interface SafeUserError {
	code: 'REQUEST_ERROR' | 'TEMPORARY_UNAVAILABLE' | 'INTERNAL_SERVER_ERROR'
	message: string
	status: number
	correlationId?: string
}

export function toSafeUserError(
	error: unknown,
	correlationId?: string,
): SafeUserError {
	const candidate = error as { status?: unknown; statusCode?: unknown }
	const candidateStatus = Number(candidate?.statusCode ?? candidate?.status)
	const status =
		Number.isInteger(candidateStatus) &&
		candidateStatus >= 400 &&
		candidateStatus <= 599
			? candidateStatus
			: 500
	const isTemporary =
		candidateStatus === 408 ||
		candidateStatus === 425 ||
		candidateStatus === 429 ||
		(candidateStatus >= 500 && candidateStatus <= 599)
	const result: SafeUserError = isTemporary
		? {
				code: 'TEMPORARY_UNAVAILABLE',
				message:
					'The service is temporarily unavailable. Please try again later.',
				status,
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
				status,
			}
	if (correlationId) result.correlationId = correlationId
	return result
}
