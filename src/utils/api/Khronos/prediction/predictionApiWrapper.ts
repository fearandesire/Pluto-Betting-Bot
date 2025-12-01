import type { DateGroupDto } from '@kh-openapi'
import {
	type AllUserPredictionsDto,
	type CreatePredictionRequest,
	type EventPredictionsDto,
	type GetActiveOutcomesRequest,
	type GetActivePredictionsForUserRequest,
	type GetAllPredictionsFilteredRequest,
	type GetPredictionByIdRequest,
	type GetPredictionsForUserRequest,
	PredictionApi,
	type RemovePredictionByIdRequest,
	type RemovePredictionRequest,
} from '@kh-openapi'
import { KH_API_CONFIG } from '../KhronosInstances.js'

// Re-export generated types for convenience
export type { GetActiveOutcomesRequest }

export default class PredictionApiWrapper {
	private predictionApi: PredictionApi
	constructor() {
		this.predictionApi = new PredictionApi(KH_API_CONFIG)
	}

	async createPrediction(
		predictionData: CreatePredictionRequest,
	): Promise<void> {
		try {
			await this.predictionApi.createPrediction(predictionData)
		} catch (error) {
			console.error('Error creating prediction:', error)
			throw error
		}
	}

	async getPredictionById(params: GetPredictionByIdRequest) {
		try {
			const response = await this.predictionApi.getPredictionById(params)
			return response
		} catch (error) {
			console.error('Error fetching prediction by id:', error)
			throw error
		}
	}

	async deletePrediction(params: RemovePredictionRequest) {
		await this.predictionApi.removePrediction(params)
	}

	async getPredictionsFiltered(
		params: GetAllPredictionsFilteredRequest,
	): Promise<AllUserPredictionsDto[]> {
		type KhronosFilteredPredictionsResponse =
			| EventPredictionsDto
			| AllUserPredictionsDto[]
		try {
			const response =
				(await this.predictionApi.getAllPredictionsFiltered(
					params,
				)) as KhronosFilteredPredictionsResponse
			if (Array.isArray(response)) {
				return response
			}
			if (Array.isArray(response?.predictions)) {
				return response.predictions as unknown as AllUserPredictionsDto[]
			}
			return []
		} catch (error) {
			console.error('Error fetching filtered predictions', error)
			throw error
		}
	}

	async getPredictionsForUser(
		params: GetPredictionsForUserRequest,
	): Promise<AllUserPredictionsDto[]> {
		const response = await this.predictionApi.getPredictionsForUser(params)
		return response
	}

	/**
	 * Get active (pending) predictions for a user
	 * @param params - Request parameters with userId
	 * @returns Array of active predictions for the user
	 */
	async getActivePredictionsForUser(
		params: GetActivePredictionsForUserRequest,
	): Promise<AllUserPredictionsDto[]> {
		try {
			const response =
				await this.predictionApi.getActivePredictionsForUser(params)
			return response
		} catch (error) {
			console.error('Error fetching active predictions for user:', error)
			throw error
		}
	}

	/**
	 * Delete a prediction by its prediction ID
	 * @param params - Request parameters with predictionId and userId
	 */
	async deletePredictionById(
		params: RemovePredictionByIdRequest,
	): Promise<void> {
		try {
			await this.predictionApi.removePredictionById(params)
		} catch (error) {
			console.error('Error deleting prediction by ID:', error)
			throw error
		}
	}

	/**
	 * Get active outcomes grouped by date and game
	 * @param params - Request parameters with optional guild_id
	 * @returns Array of date groups, each containing games with their props
	 */
	async getActiveOutcomesGrouped(
		params: GetActiveOutcomesRequest = {},
	): Promise<DateGroupDto[]> {
		try {
			const response = await this.predictionApi.getActiveOutcomes(params)
			return response
		} catch (error) {
			console.error(
				'Error fetching active outcomes grouped by date and game:',
				error,
			)
			throw error
		}
	}
}
