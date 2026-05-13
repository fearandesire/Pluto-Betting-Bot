import { WeekManagerApi } from '@pluto-khronos/api-client'
import { KH_API_CONFIG } from '../KhronosInstances.js'

export default class WeekManagerWrapper {
	private weekManagerApi: WeekManagerApi

	constructor() {
		this.weekManagerApi = new WeekManagerApi(KH_API_CONFIG)
	}
}
