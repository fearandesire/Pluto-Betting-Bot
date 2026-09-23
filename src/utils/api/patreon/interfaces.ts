import { plutoLogoUrl } from '../../../lib/configs/constants.js'
export const patreonUrl = 'https://www.patreon.com/fenix_'

export const nonPatreonMemberMsg = `This feature is only for Patreon members!\nSee ${patreonUrl} for more information.`

export const patreonFooterMsg =
	'Support Pluto via Patreon | Use `/patreon` to learn more'

export const PatreonInformation = `Pluto is completely free to use. However, it is not free to run or maintain, not to mention the time investment! Additionally, there's several key features that are a long-term goal to add, including the highly requested Parlay feature.\n\nBecoming a Patreon member and supporting Pluto will enable Pluto to grow to it\'s full potential of being the best sports betting app on Discord. New features will be added, including:\n- 🎲 **Parlay Bets**\n- 🕛 **Real-Time Game Data**\n- 👴 **Historical Game Data**\n..and more!\n\nSupport Pluto via Patreon 🡺 please click [**here**](${patreonUrl}).\n\nThank you!\n \- fenix 🎔`

export const patreonFooterUrl = plutoLogoUrl

export const patreonSponsorsOnly = `This feature is only for Patreon sponsors!\nSee ${patreonUrl} for more information.`
export const patreonFooter = {
	text: patreonFooterMsg,
	iconURL: patreonFooterUrl,
}

export interface IPatreonReadUser {
	userid: string
	name: string
	tier: string
}

export enum PatreonTiers {
	SUPPORTER = 'supporter',
	SPONSOR = 'sponsor',
}
