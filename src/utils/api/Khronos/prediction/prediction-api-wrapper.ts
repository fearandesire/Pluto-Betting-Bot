import {
	type AllUserPredictionsDto,
	type CreatePredictionRequest,
	type GetAllPredictionsFilteredRequest,
	type GetPredictionByIdRequest,
	type GetPredictionsForUserRequest,
	PredictionApi,
	type RemovePredictionRequest,
} from '../../../../openapi/khronos/index.js';
import { KH_API_CONFIG } from '../khronos-instances.js';

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
}
