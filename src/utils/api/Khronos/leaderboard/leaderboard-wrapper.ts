import { ResponseError } from '@khronos-index'
import {
	LeaderboardApi,
	type LeaderboardControllerGetLeaderboardRequest,
} from '../../../../openapi/khronos/apis/LeaderboardApi.js'
import type { SimpleLeaderboardResponseDto } from '../../../../openapi/khronos/models/index.js'
import {
	DEFAULT_RETRY_CONFIG,
	extractRetryAfter,
	isRetriableError,
	type RetryConfig,
	sleep,
} from '../../common/retry-utils.js'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export default class LeaderboardWrapper {
	private leaderboardsApi: LeaderboardApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.leaderboardsApi = new LeaderboardApi(this.khConfig)
	}

	/**
	 * @summary Retrieve leaderboard data based upon provided data
	 * @param params - Leaderboard query parameters
	 * @returns Promise resolving to leaderboard data
	 * @throws Error if API call fails after retries or rate limited
	 */
	async getLeaderboard(
		params: LeaderboardControllerGetLeaderboardRequest,
		config: Partial<RetryConfig> = {},
	): Promise<SimpleLeaderboardResponseDto> {
		const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
			try {
				return await this.leaderboardsApi.leaderboardControllerGetLeaderboard(
					params,
				)
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error(String(error))

				if (!isRetriableError(error)) {
					throw new Error(
						`Failed to fetch leaderboard: ${lastError.message}`,
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
			`Failed to fetch leaderboard after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`,
		)
	}
}
