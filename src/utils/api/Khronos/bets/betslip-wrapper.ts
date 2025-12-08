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
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

interface RetryConfig {
	maxRetries: number
	baseDelayMs: number
	maxDelayMs: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractRetryAfter(response: Response): number | null {
	const retryAfterHeader = response.headers.get('retry-after')
	if (!retryAfterHeader) return null

	const seconds = Number.parseInt(retryAfterHeader, 10)
	if (!Number.isNaN(seconds)) {
		return seconds * 1000
	}

	const date = Date.parse(retryAfterHeader)
	if (!Number.isNaN(date)) {
		return Math.max(0, date - Date.now())
	}

	return null
}

function isRetriableError(error: unknown): boolean {
	if (error instanceof ResponseError) {
		const status = error.response.status
		return status === 429 || status >= 500
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase()
		return (
			message.includes('econnrefused') ||
			message.includes('econnreset') ||
			message.includes('etimedout') ||
			message.includes('enotfound') ||
			message.includes('network error') ||
			message.includes('fetch failed') ||
			message.includes('socket hang up')
		)
	}

	return false
}

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
