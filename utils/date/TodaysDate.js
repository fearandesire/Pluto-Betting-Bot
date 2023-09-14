import { format } from 'date-fns'

/**
 * Retrieves the current date in the format MM/DD/YYYY.
 *
 * @return {string} The current date in the format MM/DD/YYYY.
 */

export function TodaysDate() {
	const today = new Date()
	return format(today, 'MM/dd/yyyy')
}
