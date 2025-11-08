export interface IApiError {
	message: string
	metadata?: Record<string, unknown>
}

export const isApiError = (value: unknown): value is IApiError =>
	typeof (value as IApiError).message === 'string'
