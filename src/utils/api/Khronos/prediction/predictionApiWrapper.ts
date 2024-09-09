import { CreatePredictionDto, PredictionApi, UpdatePredictionDto } from "@khronos-index";
import { type IKH_API_CONFIG, KH_API_CONFIG } from "../KhronosInstances.js";

export default class PredictionApiWrapper {
	private predictionApi: PredictionApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG
	constructor() {
		this.predictionApi = new PredictionApi(KH_API_CONFIG)
	}

	async createPrediction(createPredictionDto: CreatePredictionDto) {
		await this.predictionApi.predictionControllerCreate({
			createPredictionDto,
		})
	}

	async getAllPredictions() {
		await this.predictionApi.predictionControllerFindAll()
	}

	async getPredictionById(id: string) {
		await this.predictionApi.predictionControllerFindOne({ id })
	}

	async updatePrediction(
		id: string,
		updatePredictionDto: UpdatePredictionDto,
	) {
		await this.predictionApi.predictionControllerUpdate({
			id,
			updatePredictionDto,
		})
	}

	async deletePrediction(id: string) {
		await this.predictionApi.predictionControllerRemove({ id })
	}
}
