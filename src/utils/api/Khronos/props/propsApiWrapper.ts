import {
	PropsApi,
	type FindAllPropsRequest,
	type FindOnePropRequest,
	type FindPropsByDescriptionRequest,
	type GetPropsForEventRequest,
	type ManualSendPropsRequest,
	type Prop,
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
	async getAll(params: FindAllPropsRequest) {
		return await this.propsApi.findAllProps(params);
	}

	/**
	 * Get a prop by id
	 */
	async getPropById(id: string): Promise<Prop> {
		const params: FindOnePropRequest = { id, withPredictions: false };
		return await this.propsApi.findOneProp(params);
	}

	/**
	 * Get props by event id
	 * @param eventId - The id of the event to get props for
	 * @returns A promise that resolves to the raw response from the API
	 */
	async getPropsByEventId(eventId: string) {
		const params: GetPropsForEventRequest = { id: eventId };
		return await this.propsApi.getPropsForEvent(params);
	}

	/**
	 * Generate all prop embeds to be sent to the configured Guild's Props Channel / Predictions / Accuracy Channel
	 */
	async generateAllPropEmbeds(args: ManualSendPropsRequest) {
		await this.propsApi.manualSendProps(args);
	}

	/**
	 * Set the result of a prop
	 * @param params - The parameters for setting the prop result
	 * @returns A promise that resolves to the raw response from the API
	 */
	async setResult(params: SetPropResultRequest) {
		return await this.propsApi.setPropResult(params);
	}

	async getPropsByPlayer(params: FindPropsByDescriptionRequest) {
		return await this.propsApi.findPropsByDescription(params);
	}

	async getStatsProps() {
		// Add none
	}
}
