export const plutoDocsUrl = 'https://docs.pluto.fearandesire.com';
export const plutoGuildId = '777353407383339038';

export const APP_OWNER_INFO = {
	discord_username: 'fenixforever',
	discord_id: '208016830491525120',
};

export function isErr(value: unknown): Error {
	if (value instanceof Error) return value;

	let stringified = '[Unable to stringify the thrown value]';
	try {
		stringified = JSON.stringify(value);
	} catch {}

	return new Error(
		`This value was thrown as is, not through an Error: ${stringified}`,
	);
}
