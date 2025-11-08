export const plutoDocsUrl = 'https://docs.pluto.fearandesire.com'
export const pltuoDevGuild = '777353407383339038'
export const DEV_IDS = {
	guild: '777353407383339038',
	gameCategory: '1166497991935406120',
}

export const APP_OWNER_INFO = {
	discord_username: 'fenixforever',
	discord_id: '208016830491525120',
}

export function isErr(value: unknown): Error {
	if (value instanceof Error) return value

	let stringified = '[Unable to stringify the thrown value]'
	try {
		stringified = JSON.stringify(value)
	} catch {}

	return new Error(
		`This value was thrown as is, not through an Error: ${stringified}`,
	)
}
