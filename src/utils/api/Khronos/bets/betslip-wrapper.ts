import {
	BetslipsApi,
	type CancelBetslipRequest,
	type DoubleDownBetRequest,
	type DoubleDownDto,
	type GetActiveBetslipsRequest,
	type InitBetslipRequest,
	type PlaceBetslipRequest,
	type PlacedBetslip,
	type PlacedBetslipDto,
} from '@kh-openapi'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export default class BetslipWrapper {
	private betslipApi: BetslipsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG
	constructor() {
		this.betslipApi = new BetslipsApi(this.khConfig)
	}

	async init(payload: InitBetslipRequest) {
		return await this.betslipApi.initBetslip(payload)
	}

	async finalize(payload: PlaceBetslipRequest): Promise<PlacedBetslipDto> {
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

	async doubleDown(data: DoubleDownBetRequest): Promise<DoubleDownDto> {
		return await this.betslipApi.doubleDownBet(data)
	}
}
