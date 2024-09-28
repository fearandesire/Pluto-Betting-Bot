import {
	type CreatePredictionDto,
	PredictionApi,
	type UpdatePredictionDto,
} from '../../../../openapi/khronos/index.js';
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js';

export default class PredictionApiWrapper {
	private predictionApi: PredictionApi;
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG;
	constructor() {
		this.predictionApi = new PredictionApi(KH_API_CONFIG);
	}

	async createPrediction(createPredictionDto: CreatePredictionDto) {
		try {
			const response = await this.predictionApi.predictionControllerCreate({
				createPredictionDto,
			});
			return response;
		} catch (error: any) {
			if (error?.response && error?.response?.status === 409) {
				throw new Error("You've already made a prediction for this prop!");
			}
			// Handle unknown errors
			throw error;
		}
	}

	async getAllPredictions() {
		await this.predictionApi.predictionControllerFindAll();
	}

	async getPredictionById(id: string) {
		await this.predictionApi.predictionControllerFindOne({ id });
	}

	async updatePrediction(id: string, updatePredictionDto: UpdatePredictionDto) {
		await this.predictionApi.predictionControllerUpdate({
			id,
			updatePredictionDto,
		});
	}

	async deletePrediction(id: string) {
		await this.predictionApi.predictionControllerRemove({ id });
	}
}
