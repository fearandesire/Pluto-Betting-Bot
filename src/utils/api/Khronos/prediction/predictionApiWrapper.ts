import {
	type AllUserPredictionsDto,
	type CreatePredictionRequest,
	type GetAllPredictionsFilteredRequest,
	type GetPredictionByIdRequest,
	type GetPredictionsForUserRequest,
	PredictionApi,
	type RemovePredictionRequest,
	type ActiveOutcomesResponseDto,
	type GetActiveOutcomesRequest,
} from '../../../../openapi/khronos/index.js';
import { KH_API_CONFIG } from '../KhronosInstances.js';
import { logger } from '../../../logging/WinstonLogger.js';

// Re-export generated types for convenience
export type { ActiveOutcomesResponseDto, GetActiveOutcomesRequest };

export default class PredictionApiWrapper {
	private predictionApi: PredictionApi;
	constructor() {
		this.predictionApi = new PredictionApi(KH_API_CONFIG);
	}

	async createPrediction(
		predictionData: CreatePredictionRequest,
	): Promise<void> {
		try {
			await this.predictionApi.createPrediction(predictionData);
		} catch (error) {
			console.error('Error creating prediction:', error);
			throw error;
		}
	}

	async getPredictionById(params: GetPredictionByIdRequest) {
		try {
			const response = await this.predictionApi.getPredictionById(params);
			return response;
		} catch (error) {
			console.error('Error fetching prediction by id:', error);
			throw error;
		}
	}

	async deletePrediction(params: RemovePredictionRequest) {
		await this.predictionApi.removePrediction(params);
	}

	async getPredictionsFiltered(params: GetAllPredictionsFilteredRequest) {
		try {
			const response =
				await this.predictionApi.getAllPredictionsFiltered(params);
			return response;
		} catch (error) {
			console.error('Error fetching filtered predictions', error);
			throw error;
		}
	}

	async getPredictionsForUser(
		params: GetPredictionsForUserRequest,
	): Promise<AllUserPredictionsDto[]> {
		const response = await this.predictionApi.getPredictionsForUser(params);
		return response;
	}

	/**
	 * Get all outcomes (props) that have active predictions
	 * @param params - Request parameters with optional guild_id
	 * @returns List of outcomes with pending predictions
	 */
	async getActiveOutcomes(params: GetActiveOutcomesRequest = {}): Promise<ActiveOutcomesResponseDto> {
		const response = await this.predictionApi.getActiveOutcomes(params);

		await logger.info({
			message: `Retrieved ${response.total_outcomes} outcomes with active predictions`,
			metadata: {
				source: `${this.constructor.name}.${this.getActiveOutcomes.name}`,
				guildId: params.guildId,
				total_outcomes: response.total_outcomes,
			},
		});

		return response;
	}
}
