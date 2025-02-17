import {
	LeaderboardApi,
	type LeaderboardControllerGetLeaderboardV1Request,
} from '../../../../openapi/khronos/apis/LeaderboardApi.js';
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js';

export default class LeaderboardWrapper {
	private leaderboardsApi: LeaderboardApi;
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG;
	constructor() {
		this.leaderboardsApi = new LeaderboardApi(this.khConfig);
	}

	/**
	 * @summary Retrieve leaderboard data based upon provided data
	 */
	async getLeaderboard(params: LeaderboardControllerGetLeaderboardV1Request) {
		return await this.leaderboardsApi.leaderboardControllerGetLeaderboardV1(
			params,
		);
	}
}
