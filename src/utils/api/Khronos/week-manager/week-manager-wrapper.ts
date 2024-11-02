import type { SeasonWeekDto } from '../../../../openapi/khronos/models/index.js';
import {
	WeekManagerApi,
	type GetCurrentWeekRequest,
} from '../../../../openapi/khronos/apis/WeekManagerApi.js';
import { KH_API_CONFIG } from '../KhronosInstances.js';

export default class WeekManagerWrapper {
	private weekManagerApi: WeekManagerApi;

	constructor() {
		this.weekManagerApi = new WeekManagerApi(KH_API_CONFIG);
	}

	/**
	 * Retrieve the active week entity based upon the sport
	 */
	async getActiveWeek(query: GetCurrentWeekRequest): Promise<SeasonWeekDto> {
		return await this.weekManagerApi.getCurrentWeek(query);
	}
}
