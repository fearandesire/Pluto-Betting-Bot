import { KH_ValidConfigType } from '../common/interfaces/kh-pluto/kh-pluto.interface.js'
import { AxiosKhronosInstance } from '../common/axios-config.js'
import { OutgoingEndpoints } from '../common/endpoints.js'
import type { Match } from '@kh-openapi/index.js'

/**
 * Service for fetching configuration or specific aggregated data from our private Khronos API
 */
export default class KhronosManager {
	private khronosPaths: typeof OutgoingEndpoints.paths
	private readonly axiosKhronosInstance = AxiosKhronosInstance
	constructor() {
		this.khronosPaths = OutgoingEndpoints.paths
		this.axiosKhronosInstance = AxiosKhronosInstance
	}

	/**
	 * Fetch all Game Schedule Channel IDs Pluto is serving
	 * @returns @ConfigType
	 */
	async fetchConfigByType(type: KH_ValidConfigType) {
		try {
			const response = await this.axiosKhronosInstance({
				method: 'get',
				url: `${this.khronosPaths.game_schedule}/${type}`,
			})
			return response.data
		} catch (err) {
			console.error(err)
			return false
		}
	}

	/**
	 * Retrieve odds from Khronos API
	 * A guild is 1:1 with a sport, so when a user requests odds, we require which guild they are in.
	 * @param guildId
	 */
	async fetchOddsForGuild(guildId: string): Promise<
		| {
				matches: Match[]
		  }
		| false
	> {
		try {
			const response = await this.axiosKhronosInstance({
				method: 'post',
				url: `${this.khronosPaths.odds.by_sport}`,
				data: {
					guild_id: guildId,
				},
			})
			const { matches } = response.data || null
			if (!matches) return false
			return {
				matches,
			}
		} catch (err) {
			console.error(err)
			return false
		}
	}
}
