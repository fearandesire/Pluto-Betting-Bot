import { addDays, isBefore, parseISO } from 'date-fns'

export class DateManager<T extends { commence_time: string }> {
	private readonly daysAhead: number

	constructor(daysAhead: number) {
		this.daysAhead = daysAhead
	}

	filterByDateRange(items: T[]): T[] {
		const currentDate = new Date()
		const futureDate = addDays(currentDate, this.daysAhead)

		return items.filter((item) => {
			const itemDate = parseISO(item.commence_time)
			return (
				isBefore(itemDate, futureDate) &&
				isBefore(currentDate, itemDate)
			)
		})
	}

	isWithinRange(date: string): boolean {
		const currentDate = new Date()
		const futureDate = addDays(currentDate, this.daysAhead)
		const itemDate = parseISO(date)

		return isBefore(itemDate, futureDate) && isBefore(currentDate, itemDate)
	}
}
