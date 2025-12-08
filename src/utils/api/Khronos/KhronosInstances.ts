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
import fetchRetry from 'fetch-retry'

const retryingFetch = fetchRetry(global.fetch, {
	retries: 3,
	retryDelay: (attempt) => {
		return Math.pow(2, attempt) * 1000
	},
	retryOn: (attempt, error, response) => {
		if (error !== null || response?.status === 429 || response?.status >= 500) {
			return true
		}
		return false
	},
})

export const KH_API_CONFIG = new Configuration({
	basePath: `${env.KH_API_URL}`,
	headers: {
		'x-api-key': `${env.KH_PLUTO_CLIENT_KEY}`,
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
