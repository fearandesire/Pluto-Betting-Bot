import {
	type ProcessedPropDto,
	type PropDto,
	PropsApi,
	type SetPropResultDto,
	type SetPropResultResponseDto,
} from '@kh-openapi'
import { ResponseError } from '@khronos-index'
import { z } from 'zod'
import { logger } from '../../../logging/WinstonLogger.js'
import { KH_API_CONFIG } from '../KhronosInstances.js'

/**
 * Zod schema for validating GetPropOptions.
 * Ensures outcomeUuid is a valid UUID and marketId is a positive integer.
 * At least one identifier must be provided.
 */
const GetPropOptionsSchema = z
	.object({
		outcomeUuid: z.uuid('outcomeUuid must be a valid UUID').optional(),
		marketId: z.number().int().positive().optional(),
	})
	.refine(
		(data) => data.outcomeUuid !== undefined || data.marketId !== undefined,
		{
			message: 'At least one of outcomeUuid or marketId must be provided',
		},
	)

/**
 * Options for retrieving a prop by identifier.
 *
 * At least one of `outcomeUuid` or `marketId` must be provided.
 * Both can be provided simultaneously if needed.
 *
 * @example
 * ```typescript
 * // By UUID only
 * { outcomeUuid: '123e4567-e89b-12d3-a456-426614174000' }
 *
 * // By market ID only
 * { marketId: 12345 }
 *
 * // Both (redundant but allowed)
 * { outcomeUuid: '123e4567-e89b-12d3-a456-426614174000', marketId: 12345 }
 * ```
 */
export type GetPropOptions =
	| { outcomeUuid: string }
	| { marketId: number }
	| { outcomeUuid: string; marketId: number }

interface RetryConfig {
	maxRetries: number
	baseDelayMs: number
	maxDelayMs: number
	timeoutMs: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
	timeoutMs: 30000,
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractRetryAfter(response: Response): number | null {
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

function isRetriableError(error: unknown): boolean {
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(
				() => reject(new Error(`Request timeout after ${timeoutMs}ms`)),
				timeoutMs,
			),
		),
	])
}

/**
 * Wrapper for the Props Controller in Khronos
 */
export default class PropsApiWrapper {
	private propsApi: PropsApi

	constructor() {
		this.propsApi = new PropsApi(KH_API_CONFIG)
	}

	/**
	 * Get random props for a sport
	 * @param sport - Sport key (nba, nfl, etc.)
	 * @param count - Number of random props to return
	 */
	async getRandomProps(
		sport: 'nba' | 'nfl',
		count?: number,
	): Promise<PropDto[]> {
		const retryConfig = { ...DEFAULT_RETRY_CONFIG }
		const source = `${this.constructor.name}.${this.getRandomProps.name}`
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
			try {
				const response = await withTimeout(
					this.propsApi.propsControllerGetRandomProps({
						sport,
						count,
					}),
					retryConfig.timeoutMs,
				)

				await logger.info({
					message: `Retrieved ${response.length} random props for ${sport}`,
					metadata: {
						source,
						sport,
						count: response.length,
					},
				})

				return response
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error(String(error))

				if (!isRetriableError(error)) {
					await logger.error({
						message: `Failed to fetch random props: ${lastError.message}`,
						metadata: {
							source,
							sport,
							count,
							error: lastError.message,
							status:
								error instanceof ResponseError
									? error.response.status
									: undefined,
							body:
								error instanceof ResponseError
									? await error.response
											.clone()
											.json()
											.catch(() => null)
									: undefined,
						},
					})
					throw new Error(
						`Failed to fetch random props: ${lastError.message}`,
					)
				}

				if (attempt >= retryConfig.maxRetries) {
					break
				}

				let delay: number

				if (
					error instanceof ResponseError &&
					error.response.status === 429
				) {
					const retryAfter = extractRetryAfter(error.response)
					delay = retryAfter
						? Math.min(retryAfter, retryConfig.maxDelayMs)
						: retryConfig.baseDelayMs * 2 ** attempt
				} else {
					delay = Math.min(
						retryConfig.baseDelayMs * 2 ** attempt,
						retryConfig.maxDelayMs,
					)
				}

				await logger.warn({
					message: `Retrying getRandomProps (attempt ${attempt + 1}/${retryConfig.maxRetries + 1})`,
					metadata: {
						source,
						sport,
						count,
						attempt: attempt + 1,
						maxAttempts: retryConfig.maxRetries + 1,
						delay,
						error: lastError.message,
						status:
							error instanceof ResponseError
								? error.response.status
								: undefined,
					},
				})

				await sleep(delay)
			}
		}

		await logger.error({
			message: `Failed to fetch random props after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`,
			metadata: {
				source,
				sport,
				count,
				attempts: retryConfig.maxRetries + 1,
				error: lastError?.message,
				status:
					lastError && lastError instanceof ResponseError
						? lastError.response.status
						: undefined,
				body:
					lastError && lastError instanceof ResponseError
						? await lastError.response
								.clone()
								.json()
								.catch(() => null)
						: undefined,
			},
		})

		throw new Error(
			`Failed to fetch random props after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`,
		)
	}

	/**
	 * Get a single random prop
	 * @param sport - Sport key (nba, nfl, etc.)
	 */
	async getRandomProp(sport: 'nba' | 'nfl'): Promise<PropDto> {
		return await this.propsApi.propsControllerGetRandomProp({ sport })
	}

	/**
	 * Get processed player props (paired over/under) from Khronos
	 * Returns array of paired props - each object contains BOTH over and under outcomes
	 * @param sport - Sport type ('nba' or 'nfl')
	 * @param count - Number of prop PAIRS to fetch
	 * @returns Array of paired props (each containing over and under)
	 */
	async getProcessedProps(
		sport: 'nba' | 'nfl',
		count: number,
	): Promise<ProcessedPropDto[]> {
		await logger.info({
			message: `🔄 Calling Khronos /props/random/processed - requesting ${count} pairs for ${sport}`,
			metadata: {
				source: `${this.constructor.name}.${this.getProcessedProps.name}`,
				sport,
				requested_count: count,
			},
		})

		const response = await this.propsApi.propsControllerGetProcessedProps({
			sport,
			count,
		})

		await logger.info({
			message: `✅ Khronos returned ${response.length} processed prop pairs for ${sport}`,
			metadata: {
				source: `${this.constructor.name}.${this.getProcessedProps.name}`,
				sport,
				requested_count: count,
				received_count: response.length,
			},
		})

		return response
	}

	/**
	 * Get ALL available props for a sport (no count limit)
	 * Used for caching all available props
	 * @param sport - Sport key (nba, nfl, etc.)
	 * @returns All available props for the sport (flat array of outcomes)
	 */
	async getAvailableProps(sport: 'nba' | 'nfl'): Promise<PropDto[]> {
		const retryConfig = { ...DEFAULT_RETRY_CONFIG }
		const source = `${this.constructor.name}.${this.getAvailableProps.name}`
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
			try {
				const response = await withTimeout(
					this.propsApi.propsControllerGetAvailableProps({
						sport,
					}),
					retryConfig.timeoutMs,
				)

				await logger.info({
					message: `Retrieved ${response.length} available props for ${sport}`,
					metadata: {
						source,
						sport,
						count: response.length,
					},
				})

				return response
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error(String(error))

				if (!isRetriableError(error)) {
					await logger.error({
						message: `Failed to fetch available props for ${sport}: ${lastError.message}`,
						metadata: {
							source,
							sport,
							error: lastError.message,
							status:
								error instanceof ResponseError
									? error.response.status
									: undefined,
							body:
								error instanceof ResponseError
									? await error.response
											.clone()
											.json()
											.catch(() => null)
									: undefined,
						},
					})
					throw new Error(
						`Failed to fetch available props for ${sport}: ${lastError.message}`,
					)
				}

				if (attempt >= retryConfig.maxRetries) {
					break
				}

				let delay: number

				if (
					error instanceof ResponseError &&
					error.response.status === 429
				) {
					const retryAfter = extractRetryAfter(error.response)
					delay = retryAfter
						? Math.min(retryAfter, retryConfig.maxDelayMs)
						: retryConfig.baseDelayMs * 2 ** attempt
				} else {
					delay = Math.min(
						retryConfig.baseDelayMs * 2 ** attempt,
						retryConfig.maxDelayMs,
					)
				}

				await logger.warn({
					message: `Retrying getAvailableProps (attempt ${attempt + 1}/${retryConfig.maxRetries + 1})`,
					metadata: {
						source,
						sport,
						attempt: attempt + 1,
						maxAttempts: retryConfig.maxRetries + 1,
						delay,
						error: lastError.message,
						status:
							error instanceof ResponseError
								? error.response.status
								: undefined,
					},
				})

				await sleep(delay)
			}
		}

		await logger.error({
			message: `Failed to fetch available props for ${sport} after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`,
			metadata: {
				source,
				sport,
				attempts: retryConfig.maxRetries + 1,
				error: lastError?.message,
				status:
					lastError && lastError instanceof ResponseError
						? lastError.response.status
						: undefined,
				body:
					lastError && lastError instanceof ResponseError
						? await lastError.response
								.clone()
								.json()
								.catch(() => null)
						: undefined,
			},
		})

		throw new Error(
			`Failed to fetch available props for ${sport} after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`,
		)
	}

	/**
	 * Get a prop by outcome UUID or market ID
	 * @param options - Either outcomeUuid or marketId (at least one must be provided)
	 * @returns Prop details with event context including sport information
	 * @throws Error if validation fails (invalid UUID format or non-positive marketId)
	 */
	async getProp(options: GetPropOptions): Promise<PropDto> {
		const validationResult = GetPropOptionsSchema.safeParse(options)
		if (!validationResult.success) {
			throw new Error(
				`Invalid GetPropOptions: ${validationResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
			)
		}

		const validatedOptions = validationResult.data
		const outcomeUuid = validatedOptions.outcomeUuid
		const marketId = validatedOptions.marketId
		const retryConfig = { ...DEFAULT_RETRY_CONFIG }
		const source = `${this.constructor.name}.${this.getProp.name}`
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
			try {
				const response = await withTimeout(
					this.propsApi.getProp({
						outcomeUuid,
						marketId,
					}),
					retryConfig.timeoutMs,
				)

				await logger.info({
					message: `Retrieved prop${outcomeUuid ? ` by UUID: ${outcomeUuid}` : ` by market ID: ${marketId}`}`,
					metadata: {
						source,
						outcomeUuid,
						marketId,
						sport: response.event_context?.sport_title,
					},
				})

				return response
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error(String(error))

				if (!isRetriableError(error)) {
					await logger.error({
						message: `Failed to fetch prop: ${lastError.message}`,
						metadata: {
							source,
							outcomeUuid,
							marketId,
							error: lastError.message,
							status:
								error instanceof ResponseError
									? error.response.status
									: undefined,
							body:
								error instanceof ResponseError
									? await error.response
											.clone()
											.json()
											.catch(() => null)
									: undefined,
						},
					})
					throw new Error(`Failed to fetch prop: ${lastError.message}`)
				}

				if (attempt >= retryConfig.maxRetries) {
					break
				}

				let delay: number

				if (
					error instanceof ResponseError &&
					error.response.status === 429
				) {
					const retryAfter = extractRetryAfter(error.response)
					delay = retryAfter
						? Math.min(retryAfter, retryConfig.maxDelayMs)
						: retryConfig.baseDelayMs * 2 ** attempt
				} else {
					delay = Math.min(
						retryConfig.baseDelayMs * 2 ** attempt,
						retryConfig.maxDelayMs,
					)
				}

				await logger.warn({
					message: `Retrying getProp (attempt ${attempt + 1}/${retryConfig.maxRetries + 1})`,
					metadata: {
						source,
						outcomeUuid,
						marketId,
						attempt: attempt + 1,
						maxAttempts: retryConfig.maxRetries + 1,
						delay,
						error: lastError.message,
						status:
							error instanceof ResponseError
								? error.response.status
								: undefined,
					},
				})

				await sleep(delay)
			}
		}

		await logger.error({
			message: `Failed to fetch prop after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`,
			metadata: {
				source,
				outcomeUuid,
				marketId,
				attempts: retryConfig.maxRetries + 1,
				error: lastError?.message,
				status:
					lastError && lastError instanceof ResponseError
						? lastError.response.status
						: undefined,
				body:
					lastError && lastError instanceof ResponseError
						? await lastError.response
								.clone()
								.json()
								.catch(() => null)
						: undefined,
			},
		})

		throw new Error(
			`Failed to fetch prop after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`,
		)
	}

	/**
	 * Get a prop by outcome UUID (convenience method)
	 * @param outcomeUuid - The UUID of the outcome/prop
	 * @returns Prop details with event context including sport information
	 */
	async getPropByUuid(outcomeUuid: string): Promise<PropDto> {
		return this.getProp({ outcomeUuid })
	}

	/**
	 * Set the result of a prop
	 * @param dto - The parameters for setting the prop result
	 * @returns A promise that resolves to the response with prediction statistics
	 */
	async setResult(dto: SetPropResultDto): Promise<SetPropResultResponseDto> {
		const source = `${this.constructor.name}.${this.setResult.name}`

		try {
			const result = await this.propsApi.propsControllerSetPropResult({
				setPropResultDto: dto,
			})

			await logger.info({
				message: `Set prop result for ${dto.propId}`,
				metadata: {
					source,
					propId: dto.propId,
					winner: dto.winner,
					totalProcessed: result.total_predictions_count,
				},
			})

			return result
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			const status =
				error instanceof ResponseError
					? error.response.status
					: undefined

			await logger.error({
				message: `Failed to set prop result: ${errorMessage}`,
				metadata: {
					source,
					propId: dto.propId,
					winner: dto.winner,
					dto,
					error: errorMessage,
					status,
					body:
						error instanceof ResponseError
							? await error.response
									.clone()
									.json()
									.catch(() => null)
							: undefined,
				},
			})

			throw new Error(`Failed to set prop result: ${errorMessage}`)
		}
	}
}
