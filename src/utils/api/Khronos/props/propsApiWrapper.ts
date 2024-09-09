import { PropsApi } from '@khronos-index'
import { KH_API_CONFIG } from '../KhronosInstances'

/**
 * Wrapper for the Props Controller in Khronos
 */
export default class PropsApiWrapper {
	private propsApi: PropsApi

	constructor() {
		this.propsApi = new PropsApi(KH_API_CONFIG)
	}

	async getPropById(id: string) {
		const response = await this.propsApi.propsControllerFindOne({ id })
		return response
	}
}
