import {
	addDays,
	endOfDay,
	isAfter,
	isBefore,
	parseISO,
	startOfDay,
	format,
} from 'date-fns';

/**
 * A utility class for managing date-related operations, particularly for filtering items based on a date range.
 * @template T - The type of items to be filtered, must include a 'commence_time' property of type string.
 */
export class DateManager<T extends { commence_time?: string }> {
	private readonly daysAhead: number;

	/**
	 * Creates a new DateManager instance.
	 * @param {number} daysAhead - The number of days ahead to consider in the date range.
	 */
	constructor(daysAhead?: number | null) {
		this.daysAhead = daysAhead || null;
	}

	/**
	 * Filters an array of items based on their commence_time, keeping only those within the specified date range.
	 * @param {T[]} items - The array of items to filter.
	 * @returns {T[]} An array of items that fall within the specified date range.
	 */
	filterByDateRange(items: T[]): T[] {
		const currentDate = startOfDay(new Date());
		const futureDate = endOfDay(addDays(currentDate, this.daysAhead));

		return items.filter((item) => {
			if (!item.commence_time) return false;
			const itemDate = parseISO(item.commence_time);
			return isAfter(itemDate, currentDate) && isBefore(itemDate, futureDate);
		});
	}

	/**
	 * Checks if a given date is within the specified date range.
	 * @param {string} date - The date to check, in ISO 8601 format.
	 * @returns {boolean} True if the date is within the range, false otherwise.
	 */
	isWithinRange(date: string): boolean {
		const currentDate = startOfDay(new Date());
		const futureDate = endOfDay(addDays(currentDate, this.daysAhead));
		const itemDate = parseISO(date);

		return isAfter(itemDate, currentDate) && isBefore(itemDate, futureDate);
	}

	/**
	 * Creates a simple human-readable date string from an ISO 8601 timestamp.
	 * @param {string} isoTimestamp - The ISO 8601 timestamp to format.
	 * @returns {string} A formatted string in the format 'day of the week, time (12 hour format)'.
	 * @example
	 * // returns 'Mon, 2:00 PM'
	 * createSimpleHumanReadableDate('2023-04-10T14:00:00Z')
	 */
	humanReadable(isoTimestamp: string): string {
		const date = parseISO(isoTimestamp);
		return format(date, 'EEE, h:mm a');
	}
}
