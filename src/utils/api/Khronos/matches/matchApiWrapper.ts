import { MatchesApi, MatchesForSportRequest } from '@kh-openapi';
import { IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js';

export default class MatchApiWrapper {
	private matchesApi: MatchesApi;
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG;
	constructor() {
		this.matchesApi = new MatchesApi(KH_API_CONFIG);
	}

	async matchesForSport(request: MatchesForSportRequest) {
		const response = await this.matchesApi.matchesForSport(request);
		return response;
	}

	async getAllMatches() {
		const response = await this.matchesApi.getAllMatches();
		return response;
	}
}
