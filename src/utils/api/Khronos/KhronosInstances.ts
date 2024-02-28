// noinspection ES6PreferShortImport

import {
	AccountsApi,
	BetslipsApi,
	Configuration,
	DiscordConfigApi,
	GuildsApi,
	MatchesApi,
} from '@khronos-index'

export const KH_API_CONFIG = new Configuration({
	headers: {
		'admin-token': `${process.env.PLUTO_API_TOKEN}`,
	},
})

export const AccountsInstance = new AccountsApi(KH_API_CONFIG)

export const BetslipsInstance = new BetslipsApi(KH_API_CONFIG)

export const ConfigInstance = new DiscordConfigApi(KH_API_CONFIG)

export const MatchesInstance = new MatchesApi(KH_API_CONFIG)

export const GuildsInstance = new GuildsApi(KH_API_CONFIG)

export type IKH_API_CONFIG = Configuration
