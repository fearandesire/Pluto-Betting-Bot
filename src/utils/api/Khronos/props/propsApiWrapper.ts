import { PropsApi, type PropDto } from '@kh-openapi';
import type {
	SetPropResultDto,
	SetPropResultResponseDto,
} from '../../../../commands/props/types/prop-result.types.js';
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
	 * Get a prop by outcome UUID
	 * @param outcomeUuid - The UUID of the outcome/prop
	 * @returns Prop details with event context including sport information
	 * @note This requires regenerating the OpenAPI client after adding the endpoint to Khronos
	 */
	async getPropByUuid(outcomeUuid: string): Promise<PropDto> {
		// TODO: Once OpenAPI is regenerated, use: this.propsApi.propsControllerGetPropByUuid({ outcomeUuid })
		// For now, make direct HTTP call
		const response = await fetch(
			`${KH_API_CONFIG.basePath}/api/khronos/v1/props/${outcomeUuid}`,
			{
				method: 'GET',
				headers: KH_API_CONFIG.headers || {},
			},
		);

		if (!response.ok) {
			const error = await response.json().catch(() => ({
				message: response.statusText,
			}));
			throw new Error(error.message || 'Failed to fetch prop by UUID');
		}

		const prop = await response.json();
		await logger.info({
			message: `Retrieved prop by UUID: ${outcomeUuid}`,
			metadata: {
				source: `${this.constructor.name}.${this.getPropByUuid.name}`,
				outcomeUuid,
				sport: prop.event_context?.sport_title,
			},
		});

		return prop;
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
