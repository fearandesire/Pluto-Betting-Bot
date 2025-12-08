import {
	type ProcessedPropDto,
	type PropDto,
	PropsApi,
	type SetPropResultDto,
	type SetPropResultResponseDto,
} from '@kh-openapi'
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
		const response = await this.propsApi.propsControllerGetRandomProps({
			sport,
			count,
		})
		await logger.info({
			message: `Retrieved ${response.length} random props for ${sport}`,
			metadata: {
				source: `${this.constructor.name}.${this.getRandomProps.name}`,
				sport,
				count: response.length,
			},
		})
		return response
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

		const response = await this.propsApi.propsControllerGetProcessedProps(
			{
				sport,
				count,
			},
		)

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
		const response = await this.propsApi.propsControllerGetAvailableProps(
			{
				sport,
			},
		)

		await logger.info({
			message: `Retrieved ${response.length} available props for ${sport}`,
			metadata: {
				source: `${this.constructor.name}.${this.getAvailableProps.name}`,
				sport,
				count: response.length,
			},
		})

		return response
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

		const response = await this.propsApi.getProp({
			outcomeUuid,
			marketId,
		})

		await logger.info({
			message: `Retrieved prop${outcomeUuid ? ` by UUID: ${outcomeUuid}` : ` by market ID: ${marketId}`}`,
			metadata: {
				source: `${this.constructor.name}.${this.getProp.name}`,
				outcomeUuid,
				marketId,
				sport: response.event_context?.sport_title,
			},
		})

		return response
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
		const result = await this.propsApi.propsControllerSetPropResult({
			setPropResultDto: dto,
		})

		await logger.info({
			message: `Set prop result for ${dto.propId}`,
			metadata: {
				source: `${this.constructor.name}.${this.setResult.name}`,
				propId: dto.propId,
				winner: dto.winner,
				totalProcessed: result.total_predictions_count,
			},
		})

		return result
	}
}
