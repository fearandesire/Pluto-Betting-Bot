import { OddsApi } from '@kh-openapi'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export default class OddsWrapper {
	private oddsApi: OddsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG
	constructor() {
		this.oddsApi = new OddsApi(this.khConfig)
	}
}
