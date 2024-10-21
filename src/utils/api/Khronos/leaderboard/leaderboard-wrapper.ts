import {
	LeaderboardApi,
	type LeaderboardControllerGetLeaderboardRequest,
} from '../../../../openapi/khronos/apis/LeaderboardApi.js';
import { KH_API_CONFIG, type IKH_API_CONFIG } from '../KhronosInstances.js';

export default class LeaderboardWrapper {
	private leaderboardsApi: LeaderboardApi;
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG;
	constructor() {
		this.leaderboardsApi = new LeaderboardApi(this.khConfig);
	}

	/**
	 * @summary Retrieve leaderboard data based upon provided data
	 */
	async getLeaderboard(params: LeaderboardControllerGetLeaderboardRequest) {
		return await this.leaderboardsApi.leaderboardControllerGetLeaderboard(
			params,
		);
	}
}
