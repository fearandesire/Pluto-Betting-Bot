import { MatchesApi, type MatchesForSportRequest } from '@kh-openapi';
import { KH_API_CONFIG } from '../KhronosInstances.js';

export default class MatchApiWrapper {
	private matchesApi: MatchesApi;
	constructor() {
		this.matchesApi = new MatchesApi(KH_API_CONFIG);
	}

	/**
	 * Fetches matches for a specific sport
	 * @param request The request parameters for fetching sport matches
	 * @throws {Error} with a human-readable message if the request fails
	 */
	async matchesForSport(request: MatchesForSportRequest) {
		const response = await this.matchesApi.matchesForSport(request);
		return response;
	}

	/**
	 * Fetches all available matches
	 * @throws {Error} with a human-readable message if the request fails
	 */
	async getAllMatches() {
		const response = await this.matchesApi.getAllMatches();
		return response;
	}
}
