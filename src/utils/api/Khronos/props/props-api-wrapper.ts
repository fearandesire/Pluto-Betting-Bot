import {
	type PostPropsResponseDto,
	type ProcessedPropDto,
	type PropDto,
	PropsApi,
	ResponseError,
} from '@pluto-khronos/api-client'
import pTimeout from 'p-timeout'
import { z } from 'zod'
import { logger } from '../../../logging/WinstonLogger.js'

const DEFAULT_TIMEOUT_MS = 30000
// Khronos waits for Pluto's durable receipts, which can take up to ~90s in
// production, so the curated post needs a longer budget than a read.
const POST_PROPS_TIMEOUT_MS = 120000

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

/**
 * Wrapper for the Props Controller in Khronos
 */
export default class PropsApiWrapper {
	private propsApi: PropsApi

	constructor() {
		this.propsApi = new PropsApi(KH_API_CONFIG)
	}

	/**
	 * Get a single random prop
	 * @param sport - Sport key (nba, nfl, etc.)
	 */
	async getRandomProp(sport: 'nba' | 'nfl'): Promise<PropDto> {
		const source = `${this.constructor.name}.${this.getRandomProp.name}`

		try {
			const response = await pTimeout(
				this.propsApi.propsControllerGetRandomPropV1({ sport }),
				{ milliseconds: DEFAULT_TIMEOUT_MS },
			)

			await logger.info({
				message: `Retrieved random prop for ${sport}`,
				metadata: { source, sport },
			})

			return response
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			const status =
				error instanceof ResponseError
					? error.response.status
					: undefined

			await logger.error({
				message: `Failed to fetch random prop: ${errorMessage}`,
				metadata: {
					source,
					sport,
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

			throw new Error(`Failed to fetch random prop: ${errorMessage}`)
		}
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
		const source = `${this.constructor.name}.${this.getProcessedProps.name}`

		await logger.info({
			message: `🔄 Calling Khronos /props/random/processed - requesting ${count} pairs for ${sport}`,
			metadata: {
				source,
				sport,
				requested_count: count,
			},
		})

		try {
			const response = await pTimeout(
				this.propsApi.propsControllerGetProcessedPropsV1({
					sport,
					count,
				}),
				{ milliseconds: DEFAULT_TIMEOUT_MS },
			)

			await logger.info({
				message: `✅ Khronos returned ${response.length} processed prop pairs for ${sport}`,
				metadata: {
					source,
					sport,
					requested_count: count,
					received_count: response.length,
				},
			})

			return response
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			const status =
				error instanceof ResponseError
					? error.response.status
					: undefined

			// Check if this is a timeout error
			const isTimeout =
				error instanceof Error &&
				(error.name === 'TimeoutError' ||
					errorMessage.includes('timeout') ||
					errorMessage.includes('Timeout'))

			await logger.error({
				message: isTimeout
					? `Timeout fetching processed props for ${sport} after ${DEFAULT_TIMEOUT_MS}ms`
					: `Failed to fetch processed props: ${errorMessage}`,
				metadata: {
					source,
					sport,
					count,
					error: errorMessage,
					status,
					isTimeout,
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
				isTimeout
					? `Timeout fetching processed props for ${sport} after ${DEFAULT_TIMEOUT_MS}ms`
					: `Failed to fetch processed props: ${errorMessage}`,
			)
		}
	}

	/**
	 * Get ALL available props for a sport (no count limit)
	 * Used for caching all available props
	 * @param sport - Sport key (nba, nfl, etc.)
	 * @returns All available props for the sport (flat array of outcomes)
	 */
	async getAvailableProps(sport: 'nba' | 'nfl'): Promise<PropDto[]> {
		const source = `${this.constructor.name}.${this.getAvailableProps.name}`

		try {
			const response = await pTimeout(
				this.propsApi.propsControllerGetAvailablePropsV1({
					sport,
				}),
				{ milliseconds: DEFAULT_TIMEOUT_MS },
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
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			const status =
				error instanceof ResponseError
					? error.response.status
					: undefined

			await logger.error({
				message: `Failed to fetch available props for ${sport}: ${errorMessage}`,
				metadata: {
					source,
					sport,
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

			throw new Error(
				`Failed to fetch available props for ${sport}: ${errorMessage}`,
			)
		}
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
		const source = `${this.constructor.name}.${this.getProp.name}`

		try {
			const response = await pTimeout(
				this.propsApi.getProp({
					outcomeUuid,
					marketId,
				}),
				{ milliseconds: DEFAULT_TIMEOUT_MS },
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
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			const status =
				error instanceof ResponseError
					? error.response.status
					: undefined

			await logger.error({
				message: `Failed to fetch prop: ${errorMessage}`,
				metadata: {
					source,
					outcomeUuid,
					marketId,
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

			throw new Error(`Failed to fetch prop: ${errorMessage}`)
		}
	}

	/**
	 * Post a staff-curated slate through Khronos's ledger-backed endpoint.
	 * The server resolves each pair, so only the Over outcome UUIDs travel.
	 */
	async postSelectedProps(input: {
		sport: 'nba' | 'nfl'
		outcomeUuids: string[]
		guildIds: string[]
	}): Promise<PostPropsResponseDto> {
		const source = `${this.constructor.name}.${this.postSelectedProps.name}`
		try {
			const response = await pTimeout(
				this.propsApi.propsControllerPostPropsV1({
					postPropsDto: {
						sport: input.sport,
						outcome_uuids: input.outcomeUuids,
						guild_ids: input.guildIds,
					},
				}),
				{ milliseconds: POST_PROPS_TIMEOUT_MS },
			)
			await logger.info({
				message: `Posted curated props: ${response.posted} posted, ${response.skipped} skipped, ${response.failed} failed`,
				metadata: {
					source,
					sport: input.sport,
					guild_ids: input.guildIds,
					outcome_count: input.outcomeUuids.length,
					posted: response.posted,
					skipped: response.skipped,
					failed: response.failed,
				},
			})
			return response
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			const status =
				error instanceof ResponseError
					? error.response.status
					: undefined
			await logger.error({
				message: `Failed to post curated props: ${errorMessage}`,
				metadata: {
					source,
					sport: input.sport,
					guild_ids: input.guildIds,
					outcome_count: input.outcomeUuids.length,
					error: errorMessage,
					status,
				},
			})
			throw new Error(`Failed to post curated props: ${errorMessage}`)
		}
	}

	/**
	 * Get a prop by outcome UUID (convenience method)
	 * @param outcomeUuid - The UUID of the outcome/prop
	 * @returns Prop details with event context including sport information
	 */
	async getPropByUuid(outcomeUuid: string): Promise<PropDto> {
		return this.getProp({ outcomeUuid })
	}
}
