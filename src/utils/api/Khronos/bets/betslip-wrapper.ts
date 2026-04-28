import {
	BetslipsApi,
	type CancelBetslipRequest,
	type DoubleDownBetRequest,
	type DoubleDownDto,
	type GetActiveBetslipsRequest,
	type GetUserBetslipsRequest,
	type InitBetslipRequest,
	type PlaceBetslipRequest,
	type PlacedBetslip,
	type PlacedBetslipDto,
} from '@kh-openapi'
import { isMockEnabled, MockBackend } from '../../../dev/index.js'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export default class BetslipWrapper {
	private betslipApi: BetslipsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG
	private mock?: MockBackend

	constructor() {
		this.betslipApi = new BetslipsApi(this.khConfig)
		if (isMockEnabled()) this.mock = MockBackend.instance()
	}

	async init(payload: InitBetslipRequest) {
		if (this.mock) return this.mock.initBetslip(payload)
		return await this.betslipApi.initBetslip(payload)
	}

	async finalize(payload: PlaceBetslipRequest): Promise<PlacedBetslipDto> {
		if (this.mock) return this.mock.placeBetslip(payload)
		return await this.betslipApi.placeBetslip(payload)
	}

	async cancel(payload: CancelBetslipRequest) {
		if (this.mock) return this.mock.cancelBetslip(payload)
		return await this.betslipApi.cancelBetslip(payload)
	}

	async activeBetsForUser(
		userId: GetActiveBetslipsRequest,
	): Promise<PlacedBetslip[]> {
		if (this.mock) return this.mock.getActiveBetslips(userId)
		return await this.betslipApi.getActiveBetslips(userId)
	}

	/**
	 * @summary Retrieve user betslips (pending and historical)
	 * @param payload - User betslips query parameters
	 * @returns Promise resolving to array of user betslips
	 */
	async getUserBetslips(
		payload: GetUserBetslipsRequest,
	): Promise<PlacedBetslip[]> {
		if (this.mock) return this.mock.getUserBetslips(payload)
		return await this.betslipApi.getUserBetslips(payload)
	}

	async clearPending(userId: string) {
		if (this.mock) return this.mock.clearPendingBets({ userid: userId })
		return await this.betslipApi.clearPendingBets({
			userid: userId,
		})
	}

	async doubleDown(data: DoubleDownBetRequest): Promise<DoubleDownDto> {
		if (this.mock) return this.mock.doubleDownBet(data)
		return await this.betslipApi.doubleDownBet(data)
	}
}
