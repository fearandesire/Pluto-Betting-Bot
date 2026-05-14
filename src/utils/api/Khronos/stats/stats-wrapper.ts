import {
	type GetOverallH2hBettingStatsRequest,
	type OverallStatsDto,
	StatsApi,
} from '@pluto-khronos/api-client'
import { KH_API_CONFIG } from '../KhronosInstances.js'

export default class StatsWraps {
	private readonly statsApi: StatsApi

	constructor() {
		this.statsApi = new StatsApi(KH_API_CONFIG)
	}

	async getOverallStats(
		params: GetOverallH2hBettingStatsRequest,
	): Promise<OverallStatsDto> {
		const response = await this.statsApi.getOverallH2hBettingStats(params)
		return response
	}
}
