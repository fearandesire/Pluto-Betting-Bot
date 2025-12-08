import { ResponseError } from '@khronos-index'
import {
	LeaderboardApi,
	type LeaderboardControllerGetLeaderboardRequest,
} from '../../../../openapi/khronos/apis/LeaderboardApi.js'
import type { SimpleLeaderboardResponseDto } from '../../../../openapi/khronos/models/index.js'
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
