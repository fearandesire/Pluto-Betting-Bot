import {
	BetslipsApi,
	CancelBetslipRequest,
	GetActiveBetslipsRequest,
	InitBetslipRequest,
	PlaceBetslipRequest,
	PlacedBetslip,
} from '@khronos-index'
import { IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export default class BetslipWrapper {
	private betslipApi: BetslipsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG
	constructor() {
		this.betslipApi = new BetslipsApi(this.khConfig)
	}

	async init(payload: InitBetslipRequest) {
		return await this.betslipApi.initBetslip(payload)
	}

	async finalize(payload: PlaceBetslipRequest) {
		return await this.betslipApi.placeBetslip(payload)
	}

	async cancel(payload: CancelBetslipRequest) {
		return await this.betslipApi.cancelBetslip(payload)
	}

	async activeBetsForUser(
		userId: GetActiveBetslipsRequest,
	): Promise<PlacedBetslip[]> {
		return await this.betslipApi.getActiveBetslips(userId)
	}

	async clearPending(userId: string) {
		return await this.betslipApi.clearPendingBets({
			userid: userId,
		})
	}
}
