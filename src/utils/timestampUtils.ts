/**
 * Formats a date to a Discord timestamp
 * @param isoString - The ISO string or Date object to format
 * @returns The formatted Discord timestamp
 * @example formatDiscordTimestamp('2024-01-01T00:00:00Z') // <t:1714761600:f> would print as "1/1/2024, 12:00 AM"
 */
export function formatDiscordTimestamp(isoString: Date | string): string {
	const date = isoString instanceof Date ? isoString : new Date(isoString);
	return `<t:${Math.floor(date.getTime() / 1000)}:f>`; // Convert to seconds
}
