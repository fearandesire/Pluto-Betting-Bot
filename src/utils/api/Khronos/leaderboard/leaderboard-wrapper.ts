import type { SimpleLeaderboardResponseDto } from '@pluto-khronos/api-client'
import {
	LeaderboardApi,
	type LeaderboardControllerGetLeaderboardV1Request,
} from '@pluto-khronos/api-client'
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
		params: LeaderboardControllerGetLeaderboardV1Request,
	): Promise<SimpleLeaderboardResponseDto> {
		return await this.leaderboardsApi.leaderboardControllerGetLeaderboardV1(
			params,
		)
	}
}
