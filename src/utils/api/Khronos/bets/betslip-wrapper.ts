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
import { ResponseError } from '@khronos-index'
import {
	DEFAULT_RETRY_CONFIG,
	extractRetryAfter,
	isRetriableError,
	type RetryConfig,
	sleep,
} from '../../common/retry-utils.js'
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

	/**
	 * @summary Retrieve user betslips (pending and historical)
	 * @param payload - User betslips query parameters
	 * @param config - Optional retry configuration
	 * @returns Promise resolving to array of user betslips
	 * @throws Error if API call fails after retries or non-retriable error occurs
	 */
	async getUserBetslips(
		payload: GetUserBetslipsRequest,
		config: Partial<RetryConfig> = {},
	): Promise<PlacedBetslip[]> {
		const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
			try {
				return await this.betslipApi.getUserBetslips(payload)
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error(String(error))

				if (!isRetriableError(error)) {
					throw new Error(
						`Failed to fetch user betslips: ${lastError.message}`,
					)
				}

				if (attempt >= retryConfig.maxRetries) {
					break
				}

				let delay: number

				if (
					error instanceof ResponseError &&
					error.response.status === 429
				) {
					const retryAfter = extractRetryAfter(error.response)
					delay = retryAfter
						? Math.min(retryAfter, retryConfig.maxDelayMs)
						: retryConfig.baseDelayMs * 2 ** attempt
				} else {
					delay = Math.min(
						retryConfig.baseDelayMs * 2 ** attempt,
						retryConfig.maxDelayMs,
					)
				}

				await sleep(delay)
			}
		}

		throw new Error(
			`Failed to fetch user betslips after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`,
		)
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
