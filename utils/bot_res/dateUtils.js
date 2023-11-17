/**
 * Parses a cron string and checks if the date is within the current day and in the past.
 * @param {string} cronString - The cron string to parse.
 * @returns {boolean} True if the date is within the current day and in the past, false otherwise.
 */
export function isDateTodayAndPast(cronString) {
	const [minute, hour, day, month] = cronString
		.split(' ')
		.map(Number)
	const now = new Date()
	const gameDate = new Date(
		now.getFullYear(),
		month - 1,
		day,
		hour,
		minute,
	)

	return (
		gameDate.toDateString() === now.toDateString() &&
		gameDate < now
	)
}

/**
 * Checks if the time represented by a cron string is within one hour of the current time.
 * @param {string} cronString - The cron string to parse.
 * @returns {boolean} True if the time is within one hour of the current time, false otherwise.
 */
export function isWithinOneHour(cronString) {
	const [minute, hour, day, month] = cronString
		.split(' ')
		.map(Number)
	const now = new Date()
	const gameDate = new Date(
		now.getFullYear(),
		month - 1,
		day,
		hour,
		minute,
	)

	const oneHourInMilliseconds = 60 * 60 * 1000
	const timeDifference =
		gameDate.getTime() - now.getTime()

	return (
		timeDifference >= 0 &&
		timeDifference <= oneHourInMilliseconds
	)
}
