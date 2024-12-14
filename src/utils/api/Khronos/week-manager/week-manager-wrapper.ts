import {
	WeekManagerApi,
	type GetCurrentWeekDetailsRequest,
	type GetCurrentWeekNumberRequest,
} from '../../../../openapi/khronos/apis/WeekManagerApi.js';
import type { SeasonWeekDto } from '../../../../openapi/khronos/index.js';
import { KH_API_CONFIG } from '../KhronosInstances.js';

export default class WeekManagerWrapper {
	private weekManagerApi: WeekManagerApi;

	constructor() {
		this.weekManagerApi = new WeekManagerApi(KH_API_CONFIG);
	}

	/**
	 * Retrieve the active week number based upon the sport
	 */
	async getActiveWeek(query: GetCurrentWeekNumberRequest): Promise<number> {
		return await this.weekManagerApi.getCurrentWeekNumber(query);
	}

	async getActiveWeekDetails(
		query: GetCurrentWeekDetailsRequest,
	): Promise<SeasonWeekDto> {
		return await this.weekManagerApi.getCurrentWeekDetails(query);
	}
}
