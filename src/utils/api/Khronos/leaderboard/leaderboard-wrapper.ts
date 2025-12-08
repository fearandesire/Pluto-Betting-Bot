import {
	LeaderboardApi,
	type LeaderboardControllerGetLeaderboardRequest,
} from '../../../../openapi/khronos/apis/LeaderboardApi.js'
import type { SimpleLeaderboardResponseDto } from '../../../../openapi/khronos/models/index.js'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export default class LeaderboardWrapper {
	private leaderboardsApi: LeaderboardApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.leaderboardsApi = new LeaderboardApi(this.khConfig)
	}

	/**
	 * @summary Retrieve leaderboard data based upon provided data
	 * @param params - Leaderboard query parameters
	 * @returns Promise resolving to leaderboard data
	 */
	async getLeaderboard(
		params: LeaderboardControllerGetLeaderboardRequest,
	): Promise<SimpleLeaderboardResponseDto> {
		return await this.leaderboardsApi.leaderboardControllerGetLeaderboard(
			params,
		)
	}
}
