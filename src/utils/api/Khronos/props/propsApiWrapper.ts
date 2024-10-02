import {
	PropsApi,
	type FindOnePropRequest,
	type SetPropResultRequest,
} from '@kh-openapi';
import { KH_API_CONFIG } from '../KhronosInstances.js';

/**
 * Wrapper for the Props Controller in Khronos
 */
export default class PropsApiWrapper {
	private propsApi: PropsApi;

	constructor() {
		this.propsApi = new PropsApi(KH_API_CONFIG);
	}

	/**
	 * Get all props
	 * @param params - Optional parameters for finding props
	 * @returns A promise that resolves to the raw response from the API
	 */
	async getAll(params: { recent?: boolean; withActivePredictions?: boolean }) {
		return await this.propsApi.findAllProps(params);
	}

	/**
	 * Get a prop by id
	 */
	async getPropById(id: string) {
		const params: FindOnePropRequest = { id };
		return await this.propsApi.findOneProp(params);
	}

	/**
	 * Generate all prop embeds to be sent to the configured Guild's Props Channel / Predictions / Accuracy Channel
	 */
	async generateAllPropEmbeds() {
		await this.propsApi.manualSendProps();
	}

	/**
	 * Set the result of a prop
	 * @param params - The parameters for setting the prop result
	 * @returns A promise that resolves to the raw response from the API
	 */
	async setResult(params: SetPropResultRequest) {
		try {
			return await this.propsApi.setPropResult(params);
		} catch (error: any) {
			if (error?.response) {
				const errorData = await error.response.json();
				throw new Error(errorData.message);
			}
			throw error;
		}
	}
}
