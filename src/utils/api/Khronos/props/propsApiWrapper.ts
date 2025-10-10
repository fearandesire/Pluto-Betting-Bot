import {
	PropsApi,
	type ProcessedPropDto,
	type PropDto,
	type SetPropResultDto,
	type SetPropResultResponseDto,
} from '@kh-openapi';
import { logger } from '../../../logging/WinstonLogger.js';
import { KH_API_CONFIG } from '../KhronosInstances.js';

/**
 * Wrapper for the Props Controller in Khronos
 * Note: After API streamlining, only random props and result setting are available
 */
export default class PropsApiWrapper {
	private propsApi: PropsApi;

	constructor() {
		this.propsApi = new PropsApi(KH_API_CONFIG);
	}

	/**
	 * Get random props for a sport
	 * @param sport - Sport key (nba, nfl, etc.)
	 * @param count - Number of random props to return
	 */
	async getRandomProps(sport: 'nba' | 'nfl', count?: number): Promise<PropDto[]> {
		const response = await this.propsApi.propsControllerGetRandomPropsV1({
			sport,
			count,
		});
		await logger.info({
			message: `Retrieved ${response.length} random props for ${sport}`,
			metadata: {
				source: `${this.constructor.name}.${this.getRandomProps.name}`,
				sport,
				count: response.length,
			},
		});
		return response;
	}

	/**
	 * Get a single random prop
	 * @param sport - Sport key (nba, nfl, etc.)
	 */
	async getRandomProp(sport: 'nba' | 'nfl'): Promise<PropDto> {
		return await this.propsApi.propsControllerGetRandomPropV1({ sport });
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
		});

		const response = await this.propsApi.propsControllerGetProcessedPropsV1({
			sport,
			count,
		});

		await logger.info({
			message: `✅ Khronos returned ${response.length} processed prop pairs for ${sport}`,
			metadata: {
				source: `${this.constructor.name}.${this.getProcessedProps.name}`,
				sport,
				requested_count: count,
				received_count: response.length,
			},
		});

		return response;
	}

	/**
	 * Get ALL available props for a sport (no count limit)
	 * Used for caching all available props
	 * @param sport - Sport key (nba, nfl, etc.)
	 * @returns All available props for the sport (flat array of outcomes)
	 */
	async getAvailableProps(sport: 'nba' | 'nfl'): Promise<PropDto[]> {
		const response = await this.propsApi.propsControllerGetAvailablePropsV1({
			sport,
		});

		await logger.info({
			message: `Retrieved ${response.length} available props for ${sport}`,
			metadata: {
				source: `${this.constructor.name}.${this.getAvailableProps.name}`,
				sport,
				count: response.length,
			},
		});

		return response;
	}

	/**
	 * Get a prop by outcome UUID
	 * @param outcomeUuid - The UUID of the outcome/prop
	 * @returns Prop details with event context including sport information
	 */
	async getPropByUuid(outcomeUuid: string): Promise<PropDto> {
		const response = await this.propsApi.propsControllerGetPropByUuidV1({
			outcomeUuid,
		});

		await logger.info({
			message: `Retrieved prop by UUID: ${outcomeUuid}`,
			metadata: {
				source: `${this.constructor.name}.${this.getPropByUuid.name}`,
				outcomeUuid,
				sport: response.event_context?.sport_title,
			},
		});

		return response;
	}

	/**
	 * Set the result of a prop
	 * @param dto - The parameters for setting the prop result
	 * @returns A promise that resolves to the response with prediction statistics
	 */
	async setResult(dto: SetPropResultDto): Promise<SetPropResultResponseDto> {
		const result = await this.propsApi.propsControllerSetPropResultV1({
			setPropResultDto: dto,
		});

		await logger.info({
			message: `Set prop result for ${dto.propId}`,
			metadata: {
				source: `${this.constructor.name}.${this.setResult.name}`,
				propId: dto.propId,
				winner: dto.winner,
				totalProcessed: result.total_predictions_count,
			},
		});

		return result;
	}
}
