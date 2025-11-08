import { CalendarApi, type GetSeasonYearRequest } from '@kh-openapi'
import { isAxiosError } from 'axios'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export default class CalendarWrapper {
	private calendarApi: CalendarApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.calendarApi = new CalendarApi(this.khConfig)
	}

	async getSeasonYear(params: GetSeasonYearRequest): Promise<number> {
		try {
			return await this.calendarApi.getSeasonYear(params)
		} catch (error) {
			if (isAxiosError(error)) {
				console.error(
					'Error making API request to retrieve season year.',
					{
						params,
						error: error.response?.data,
					},
				)
			} else {
				console.error(
					'Error making API request to retrieve season year.',
					{
						params,
						error,
					},
				)
			}
			throw error
		}
	}
}
