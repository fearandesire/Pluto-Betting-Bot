export function formatDiscordTimestamp(isoString: Date): string {
	const date = isoString instanceof Date ? isoString : new Date(isoString)
	return `<t:${Math.floor(date.getTime() / 1000)}:f>` // Convert to seconds
}
