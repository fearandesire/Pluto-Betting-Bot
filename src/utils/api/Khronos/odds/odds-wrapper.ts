import { IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'
import { OddsApi } from '@khronos-index'

export default class OddsWrapper {
	private oddsApi: OddsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG
	constructor() {
		this.oddsApi = new OddsApi(this.khConfig)
	}
}
