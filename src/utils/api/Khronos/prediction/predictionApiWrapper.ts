import {
	type AllUserPredictionsDto,
	type GetAllPredictionsFilteredRequest,
	type GetPredictionByIdRequest,
	type GetPredictionsForUserRequest,
	PredictionApi,
	type RemovePredictionRequest,
	type CreatePredictionRequest,
} from '../../../../openapi/khronos/index.js';
import { KH_API_CONFIG } from '../KhronosInstances.js';

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
		await this.predictionApi.getPredictionById(params);
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
