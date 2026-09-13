import {
	BetslipsApi,
	type CancelBetslipRequest,
	type DoubleDownBetRequest,
	type DoubleDownDto,
	type GetActiveBetslipsRequest,
	type GetUserBetslipsRequest,
	type InitBetslipRequest,
	type PlaceBetDto,
	type PlaceBetslipRequest,
	type PlacedBetslip,
	type PlacedBetslipDto,
} from '@pluto-khronos/api-client'
import { isMockEnabled, MockBackend } from '../../../dev/index.js'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

type CancelRequestWithGuild = CancelBetslipRequest & {
	guildId: string
}

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

		const placementId = (
			payload.placeBetDto as PlaceBetDto & { placement_id?: string }
		).placement_id
		if (!placementId) return await this.betslipApi.placeBetslip(payload)

		// The generated client gains placement_id after the next Khronos release.
		return await this.betslipApi.placeBetslip(
			payload,
			async ({ init }) => ({
				...init,
				body: JSON.stringify({
					...JSON.parse(String(init.body)),
					placement_id: placementId,
				}),
			}),
		)
	}

	async cancel(payload: CancelRequestWithGuild) {
		if (this.mock) return this.mock.cancelBetslip(payload)
		const { guildId, ...request } = payload as CancelBetslipRequest & {
			guildId?: string
		}
		return await this.betslipApi.cancelBetslip(
			{
				...request,
				patreonDataDto: {
					...request.patreonDataDto,
					guild_id: guildId,
				},
			} as CancelBetslipRequest,
			async ({ init }) => ({
				...init,
				body: JSON.stringify({
					...JSON.parse(String(init.body)),
					guild_id: guildId,
				}),
			}),
		)
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
