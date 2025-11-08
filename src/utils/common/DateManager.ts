import {
	addDays,
	endOfDay,
	format,
	isAfter,
	isBefore,
	isValid,
	parseISO,
	startOfDay,
} from 'date-fns'

/**
 * A utility class for managing date-related operations, particularly for filtering items based on a date range.
 * @template T - The type of items to be filtered, must include a 'commence_time' property of type string.
 */
export class DateManager<T extends { commence_time?: string }> {
	private readonly daysAhead: number

	/**
	 * Creates a new DateManager instance.
	 * @param {number} daysAhead - The number of days ahead to consider in the date range.
	 */
	constructor(daysAhead?: number | null) {
		this.daysAhead = daysAhead || null
	}

	/**
	 * Filters an array of items based on their commence_time, keeping only those within the specified date range.
	 * @param {T[]} items - The array of items to filter.
	 * @returns {T[]} An array of items that fall within the specified date range.
	 */
	filterByDateRange(items: T[]): T[] {
		const currentDate = startOfDay(new Date())
		const futureDate = endOfDay(addDays(currentDate, this.daysAhead))

		return items.filter((item) => {
			if (!item.commence_time) return false
			const itemDate = parseISO(item.commence_time)
			return (
				isAfter(itemDate, currentDate) && isBefore(itemDate, futureDate)
			)
		})
	}

	/**
	 * Checks if a given date is within the specified date range.
	 * @param {string} date - The date to check, in ISO 8601 format.
	 * @returns {boolean} True if the date is within the range, false otherwise.
	 */
	isWithinRange(date: string): boolean {
		const currentDate = startOfDay(new Date())
		const futureDate = endOfDay(addDays(currentDate, this.daysAhead))
		const itemDate = parseISO(date)

		return isAfter(itemDate, currentDate) && isBefore(itemDate, futureDate)
	}

	toMMDDYYYY(input: string | Date): string {
		const date = new Date(input)
		return format(date, 'MM/dd/yyyy')
	}

	/**
	 * Creates a simple human-readable date string from an ISO 8601 timestamp or Date object.
	 * @param {string | Date} input - The ISO 8601 timestamp or Date object to format.
	 * @returns {string} A formatted string in the format  in a Discord Unix Timestamp
	 */
	toDiscordUnix(input: string | Date): string {
		try {
			let date: Date
			if (typeof input === 'string') {
				date = parseISO(input)
			} else if (input instanceof Date) {
				date = input
			} else {
				throw new Error('Invalid input type')
			}

			if (!isValid(date)) {
				throw new Error('Invalid date')
			}

			const unixTimestamp = Math.floor(date.getTime() / 1000)
			return `<t:${unixTimestamp}:d> @ <t:${unixTimestamp}:t>`
		} catch (error) {
			console.error(`Error parsing date: ${input}`, error)
			return 'Invalid Date'
		}
	}
}
