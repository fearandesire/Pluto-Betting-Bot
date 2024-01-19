import axios from 'axios'
import { pluto_api_url } from '../../serverConfig.js'
import {
	KH_ValidConfigType,
	SportsServing,
} from 'lib/interfaces/api/ApiInterfaces.js'

export default class KhronosManager {
	private url: string
	private epts: {
		game_schedule: string
		categories: {
			by_sport: string
			all: string
		}
	}
	constructor() {
		this.url = `${pluto_api_url}`
		this.epts = {
			game_schedule: 'discord/config/type',
			categories: {
				by_sport: 'discord/configs/games',
				all: 'discord/configs/games/all',
			},
		}
	}

	/**
	 * Fetch all Game Schedule Channel IDs Pluto is serving
	 * @returns @ConfigType
	 */
	async fetchGameScheduleChannels() {
		const channelsData = await this.fetchByType(`DAILY_SCHEDULE_CHAN`)
		return channelsData
	}

	async fetchByType(type: KH_ValidConfigType) {
		try {
			const response = await axios.get(
				`${pluto_api_url}/${this.epts.game_schedule}`,
				{
					params: {
						type,
					},
					headers: {
						'admin-token': `${process.env.PLUTO_API_TOKEN}`,
					},
				},
			)
			return response.data
		} catch (err) {
			console.error(err)
			return false
		}
	}

	/**
	 * Fetch Categories Pluto is serving for a specific sport
	 * @returns @ConfigType
	 */
	async fetchGameCategoriesBySport(sport: SportsServing) {
		try {
			const response = await axios.get(
				`${pluto_api_url}/${this.epts.categories.by_sport}`,
				{
					params: {
						sport: `${sport.toUpperCase()}`,
					},
					headers: {
						'admin-token': `${process.env.PLUTO_API_TOKEN}`,
					},
				},
			)
			return response.data
		} catch (err) {
			console.error(err)
			return false
		}
	}

	/**
	 * Fetch All Game Channel Category IDs Pluto is serving
	 * @returns @ConfigType
	 */
	async fetchGameCategories() {
		try {
			const response = await axios.get(
				`${pluto_api_url}/${this.epts.categories.all}`,
				{
					headers: {
						'admin-token': `${process.env.PLUTO_API_TOKEN}`,
					},
				},
			)
			return response.data
		} catch (err) {
			console.error(err)
			return false
		}
	}
}
