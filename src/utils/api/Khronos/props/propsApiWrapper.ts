import { PropsApi } from "@khronos-index";
import { KH_API_CONFIG } from "../KhronosInstances.js";

/**
 * Wrapper for the Props Controller in Khronos
 */
export default class PropsApiWrapper {
	private propsApi: PropsApi

	constructor() {
		this.propsApi = new PropsApi(KH_API_CONFIG)
	}

	async getPropById(id: string) {
		return await this.propsApi.propsControllerFindOne({ id })
	}
}
