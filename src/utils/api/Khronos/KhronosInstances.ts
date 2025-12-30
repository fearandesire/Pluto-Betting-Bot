import fetchRetry from 'fetch-retry'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import env from '../../../lib/startup/env.js'
/**
 * @module KhronosApi
 * @readonly
 * @category KhronosApi
 * @description This module is used to establish access to the external API system, Khronos.
 * Khronos is the main API used for Pluto and handles most of it's features
 */
import {
	AccountsApi,
	BetslipsApi,
	ChangelogsApi,
	Configuration,
	DiscordConfigApi,
	GuildsApi,
	MatchesApi,
} from '../../../openapi/khronos/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = join(__dirname, '../../../../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const SERVICE_NAME = 'Pluto-Betting-Bot'
const SERVICE_VERSION = packageJson.version || '1.0.0'

const retryingFetch = fetchRetry(global.fetch, {
	retries: 3,
	retryDelay: (attempt, error, response) => {
		// Check for Retry-After header (especially for 429 rate limit responses)
		if (response?.status === 429) {
			const retryAfterHeader = response.headers.get('retry-after')
			if (retryAfterHeader) {
				const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10)
				if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
					// Convert to milliseconds and add small jitter to prevent synchronized retries
					const retryAfterMs = retryAfterSeconds * 1000
					const jitter = retryAfterMs * 0.1 * Math.random() // 10% jitter
					return retryAfterMs + jitter
				}
				// Try parsing as HTTP-date
				const retryAfterDate = Date.parse(retryAfterHeader)
				if (!Number.isNaN(retryAfterDate)) {
					const retryAfterMs = Math.max(
						0,
						retryAfterDate - Date.now(),
					)
					const jitter = retryAfterMs * 0.1 * Math.random()
					return retryAfterMs + jitter
				}
			}
		}

		// Exponential backoff: baseDelay * 2^attempt
		const baseDelayMs = 1000
		const exponentialDelay = baseDelayMs * Math.pow(2, attempt)

		// Add jitter to prevent thundering herd (20% of delay)
		const jitterFactor = 0.2
		const jitter = exponentialDelay * jitterFactor * Math.random()
		const delayWithJitter = exponentialDelay + jitter

		// Cap at 30 seconds
		const maxDelayMs = 30000
		return Math.min(delayWithJitter, maxDelayMs)
	},
	retryOn: (attempt, error, response) => {
		if (
			error !== null ||
			response?.status === 429 ||
			response?.status >= 500
		) {
			return true
		}
		return false
	},
})

export const KH_API_CONFIG = new Configuration({
	basePath: `${env.KH_API_URL}`,
	headers: {
		'x-api-key': `${env.KH_PLUTO_CLIENT_KEY}`,
		'User-Agent': `${SERVICE_NAME}/${SERVICE_VERSION}`,
		'X-Service-Name': SERVICE_NAME,
	},
	fetchApi: retryingFetch,
})

export const AccountsInstance = new AccountsApi(KH_API_CONFIG)

export const BetslipsInstance = new BetslipsApi(KH_API_CONFIG)

export const ConfigInstance = new DiscordConfigApi(KH_API_CONFIG)

export const MatchesInstance = new MatchesApi(KH_API_CONFIG)

export const GuildsInstance = new GuildsApi(KH_API_CONFIG)

export const ChangelogsInstance = new ChangelogsApi(KH_API_CONFIG)

export type IKH_API_CONFIG = Configuration
