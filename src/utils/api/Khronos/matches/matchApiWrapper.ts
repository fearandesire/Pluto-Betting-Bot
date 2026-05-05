import { MatchesApi, type MatchesForSportRequest } from '@kh-openapi'
import { isMockEnabled, MockBackend } from '../../../dev/index.js'
import { KH_API_CONFIG } from '../KhronosInstances.js'

export default class MatchApiWrapper {
	private matchesApi: MatchesApi
	private mock?: MockBackend

	constructor() {
		this.matchesApi = new MatchesApi(KH_API_CONFIG)
		if (isMockEnabled()) this.mock = MockBackend.instance()
	}

	/**
	 * Fetches matches for a specific sport
	 * @param request The request parameters for fetching sport matches
	 * @throws {Error} with a human-readable message if the request fails
	 */
	async matchesForSport(request: MatchesForSportRequest) {
		if (this.mock) return this.mock.getMatchesForSport(request)
		const response = await this.matchesApi.matchesForSport(request)
		return response
	}

	/**
	 * Fetches all available matches
	 * @throws {Error} with a human-readable message if the request fails
	 */
	async getAllMatches() {
		if (this.mock) return this.mock.getAllMatches()
		const response = await this.matchesApi.getAllMatches()
		return response
	}
}
