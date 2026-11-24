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
} from '@pluto-khronos/api-client'
import fetchRetry from 'fetch-retry'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import env from '../../../lib/startup/env.js'
import {
	REQUEST_ID_HEADER,
	withRequestIdHeader,
} from '../../../lib/telemetry/request-context.js'
import { getDefaultAlertReporter } from '../../../services/alerts/alert-reporter.js'
import { ConsecutiveFailureTracker } from '../../../services/alerts/failure-trackers.js'
import { checkBettingOutage } from './betting-outage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = join(__dirname, '../../../../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const SERVICE_NAME = 'Pluto-Betting-Bot'
const SERVICE_VERSION = packageJson.version || '1.0.0'
const khronosConnectivity = new ConsecutiveFailureTracker(
	{
		firing: async (input) => getDefaultAlertReporter()?.firing(input),
		resolved: async (input) => getDefaultAlertReporter()?.resolved(input),
	},
	{
		key: 'khronos.unreachable',
		scope: 'api',
		severity: 'critical',
		title: 'Khronos is unreachable',
		summary: 'Pluto cannot reach the scheduling service.',
		threshold: 5,
	},
)

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
					const retryAfterMs = Math.min(
						retryAfterSeconds * 1000,
						30000,
					)
					const jitter = retryAfterMs * 0.1 * Math.random() // 10% jitter
					return retryAfterMs + jitter
				}
				// Try parsing as HTTP-date
				const retryAfterDate = Date.parse(retryAfterHeader)
				if (!Number.isNaN(retryAfterDate)) {
					const retryAfterMs = Math.min(
						30000,
						Math.max(0, retryAfterDate - Date.now()),
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
	retryOn: (_attempt, error, response) => {
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

const requestUrlOf = (input: RequestInfo | URL): string =>
	typeof input === 'string'
		? input
		: input instanceof URL
			? input.href
			: input.url

// Betting placement calls go through the generated client, so this is the hook
// that sees them. Retries happen inside retryingFetch, so only the final outcome pages ops.
const observedFetch: typeof retryingFetch = async (input, init) => {
	const requestInit = withRequestIdHeader(init)
	const url = requestUrlOf(input)
	const requestId =
		new Headers(requestInit.headers).get(REQUEST_ID_HEADER) ?? undefined
	try {
		const response = await retryingFetch(input, requestInit)
		if (response.ok) {
			void khronosConnectivity.success().catch(() => undefined)
		} else if (response.status === 429 || response.status >= 500) {
			void khronosConnectivity.failure().catch(() => undefined)
		}
		checkBettingOutage({ url, requestId, status: response.status })
		return response
	} catch (error) {
		void khronosConnectivity.failure().catch(() => undefined)
		checkBettingOutage({ url, requestId, error })
		throw error
	}
}

export const KH_API_CONFIG = new Configuration({
	basePath: `${env.KH_API_URL}`,
	headers: {
		'x-api-key': `${env.KH_PLUTO_CLIENT_KEY}`,
		'User-Agent': `${SERVICE_NAME}/${SERVICE_VERSION}`,
		'X-Service-Name': SERVICE_NAME,
	},
	fetchApi: observedFetch,
})

export const AccountsInstance = new AccountsApi(KH_API_CONFIG)

export const BetslipsInstance = new BetslipsApi(KH_API_CONFIG)

export const ConfigInstance = new DiscordConfigApi(KH_API_CONFIG)

export const MatchesInstance = new MatchesApi(KH_API_CONFIG)

export const GuildsInstance = new GuildsApi(KH_API_CONFIG)

export const ChangelogsInstance = new ChangelogsApi(KH_API_CONFIG)

export type IKH_API_CONFIG = Configuration
