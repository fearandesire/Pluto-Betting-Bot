import {
	type CreatePredictionDto,
	type GetPredictionByIdRequest,
	PredictionApi,
	type RemovePredictionRequest,
} from '../../../../openapi/khronos/index.js';
import { KH_API_CONFIG } from '../KhronosInstances.js';

export default class PredictionApiWrapper {
	private predictionApi: PredictionApi;
	constructor() {
		this.predictionApi = new PredictionApi(KH_API_CONFIG);
	}

	async createPrediction(createPredictionDto: CreatePredictionDto) {
		try {
			const response = await this.predictionApi.createPrediction({
				createPredictionDto,
			});
			return response;
		} catch (error: any) {
			if (error?.response && error?.response?.status === 409) {
				throw new Error("You've already made a prediction for this prop!");
			}
			// Handle unknown errors
			console.error('Unknown error creating prediction', error);
			throw error;
		}
	}

	async getPredictionById(params: GetPredictionByIdRequest) {
		await this.predictionApi.getPredictionById(params);
	}

	async deletePrediction(params: RemovePredictionRequest) {
		await this.predictionApi.removePrediction(params);
	}
}
