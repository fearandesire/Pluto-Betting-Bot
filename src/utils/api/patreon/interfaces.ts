export const patreonUrl = `https://www.patreon.com/fenix_`

export const nonPatreonMemberMsg = `This feature is only for Patreon members!\nSee ${patreonUrl} for more information.`

export const patreonFooterMsg = `Support continued development via Patreon | Use \`/patreon\` to learn more`

export const PatreonInformation = `Pluto is completely free to use. However, it is not free to run or maintain, not to mention the time investment! Additionally, there's several key features that are a long-term goal to add, including the highly requested Parlay feature.\n\nBecoming a Patreon member and supporting Pluto will enable Pluto to grow to it\'s full potential of being the best sports betting app on Discord. New features will be added, including:\n- 🎲 **Parlay Bets**\n- 🕛 **Real-Time Game Data**\n- 👴 **Historical Game Data**\n..and more!\n\nSupport Pluto via Patreon 🡺 please click [**here**](${patreonUrl}).\n\nThank you!\n \- fenix 🎔`

export const patreonFooterUrl = `https://i.imgur.com/qG3Mm5t.png`

export const patreonFooter = {
	text: patreonFooterMsg,
	iconURL: patreonFooterUrl,
}

export interface IPatreonReadUser {
	userid: string
	name: string
	tier: string
}
