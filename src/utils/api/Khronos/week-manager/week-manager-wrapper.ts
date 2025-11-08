import { WeekManagerApi } from '../../../../openapi/khronos/apis/WeekManagerApi.js'
import { KH_API_CONFIG } from '../KhronosInstances.js'

export default class WeekManagerWrapper {
	private weekManagerApi: WeekManagerApi

	constructor() {
		this.weekManagerApi = new WeekManagerApi(KH_API_CONFIG)
	}
}
