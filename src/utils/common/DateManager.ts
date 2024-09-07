import { addDays, isBefore, isAfter, parseISO } from 'date-fns'

/**
 * A utility class for managing date-related operations, particularly for filtering items based on a date range.
 * @template T - The type of items to be filtered, must include a 'commence_time' property of type string.
 */
export class DateManager<T extends { commence_time: string }> {
	private readonly daysAhead: number

	/**
	 * Creates a new DateManager instance.
	 * @param {number} daysAhead - The number of days ahead to consider in the date range.
	 */
	constructor(daysAhead: number) {
		this.daysAhead = daysAhead
	}

	/**
	 * Filters an array of items based on their commence_time, keeping only those within the specified date range.
	 * @param {T[]} items - The array of items to filter.
	 * @returns {T[]} An array of items that fall within the specified date range.
	 */
	filterByDateRange(items: T[]): T[] {
		const currentDate = new Date()
		const futureDate = addDays(currentDate, this.daysAhead)

		return items.filter((item) => {
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
		const currentDate = new Date()
		const futureDate = addDays(currentDate, this.daysAhead)
		const itemDate = parseISO(date)

		return isAfter(itemDate, currentDate) && isBefore(itemDate, futureDate)
	}
}
