import { KH_API_CONFIG } from '../KhronosInstances.js';

import {
	StatsApi,
	type GetOverallH2hBettingStatsRequest,
	type OverallStatsDto,
} from '../../../../openapi/khronos/index.js';

export default class StatsWraps {
	private readonly statsApi: StatsApi;

	constructor() {
		this.statsApi = new StatsApi(KH_API_CONFIG);
	}

	async getOverallStats(
		params: GetOverallH2hBettingStatsRequest,
	): Promise<OverallStatsDto> {
		const response = await this.statsApi.getOverallH2hBettingStats(params);
		return response;
	}
}
