import type { DateGroupDto } from 'src/openapi/khronos/models/DateGroupDto.js';
import {
	type AllUserPredictionsDto,
	type CreatePredictionRequest,
	type GetActiveOutcomesRequest,
	type GetAllPredictionsFilteredRequest,
	type GetPredictionByIdRequest,
	type GetPredictionsForUserRequest,
	PredictionApi,
	type RemovePredictionRequest,
} from '../../../../openapi/khronos/index.js';
import { KH_API_CONFIG } from '../KhronosInstances.js';

// Re-export generated types for convenience
export type { GetActiveOutcomesRequest };

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
	 * Get active outcomes grouped by date and game
	 * @param params - Request parameters with optional guild_id
	 * @returns Array of date groups, each containing games with their props
	 */
	async getActiveOutcomesGrouped(params: GetActiveOutcomesRequest = {}): Promise<DateGroupDto[]> {
		try {
			const response = await this.predictionApi.getActiveOutcomes(params);
			return response;
		} catch (error) {
			console.error('Error fetching active outcomes grouped by date and game:', error);
			throw error;
		}
	}
}
