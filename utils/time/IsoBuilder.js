/**
 * A module for building ISO formatted dates.
 * @module IsoBuilder
 */

import {
	format,
	isAfter,
	isToday,
	parseISO,
	getHours,
	getMinutes,
	getDay,
	isValid,
	startOfWeek,
	isWithinInterval,
	endOfWeek,
	addMinutes,
	isBefore,
	isSameWeek,
	isSameDay,
} from 'date-fns'

export default class IsoBuilder {
	/**
	 * Creates a new instance of IsoBuilder with the given time.
	 * @param {string} time - A string representing a valid date and time in ISO format.
	 */
	constructor(time, compare) {
		this.parseTime = parseISO(time) || null
		this.compare = parseISO(compare) || null
		this.dateObj = new Date()
		this.hours = getHours(this.parseTime)
		this.minutes = getMinutes(this.parseTime)
		this.day = getDay(this.parseTime)
	}

	isMatchingDate() {
		// Check if they are the same day
		if (isSameDay(this.parseTime, this.compare)) {
			return true
		}
		return false
	}

	/**
	 * @method withinNFLWeek
	 *
	 * Verify if a date is within the current NFL Week
	 * NFL Week is every wednesday; So this method will check between this week's wednesday and next wednesday
	 * @returns {boolean} True if the date is within the current week, otherwise false.
	 */
	withinNFLWeek() {
		const currentDate = this.dateObj
		let currentDay = currentDate.getDay()

		// ! Edge-case for anomaly where there is a game for wednesday
		// ! This will allow the module to work properly
		if (currentDay === 3) {
			currentDate.setDate(new Date().getDate() + 1)
			currentDay += 1
		}

		// Get the next Wednesday date
		const nextWednesday = new Date(currentDate)
		nextWednesday.setDate(
			currentDate.getDate() +
				((3 - currentDay + 7) % 7),
		)

		// Get the Wednesday of this week
		const thisWednesday = new Date(nextWednesday)
		thisWednesday.setDate(nextWednesday.getDate() - 7)

		// Check if the date is within this week's Wednesday or the next Wednesday
		const targetDate = this.parseTime
		const isWithinWeek =
			targetDate >= thisWednesday &&
			targetDate < nextWednesday
		return isWithinWeek
	}

	/**
	 * Formats the date using the specified format.
	 * @param {string} style - A string representing the desired format.
	 * @returns {string} The date formatted in the specified style.
	 */
	format(style) {
		return format(this.parseTime, style)
	}

	/**
	 * Determines whether the date is in the past.
	 * @returns {boolean} True if the date is in the past, otherwise false.
	 */
	filterPast() {
		return isAfter(this.parseTime, new Date())
	}

	/**
	 * Filter out any games that are not within Monday - Sunday of the current week
	 * @returns {boolean} True if the date is within the current week, otherwise false.
	 */

	withinThisWeek() {
		const currentWeekStart = startOfWeek(new Date())
		const currentWeekEnd = endOfWeek(new Date())
		const withinWeek = isWithinInterval(
			this.parseTime,
			{
				start: currentWeekStart,
				end: currentWeekEnd,
			},
		)
		return withinWeek
	}

	/**
	 * Determines whether the date is today.
	 * @returns {boolean} True if the date is today, otherwise false.
	 */
	isToday() {
		return isToday(this.parseTime)
	}

	/**
	 * Converts the date to a cron job formatted string.
	 * @returns {string} The date formatted as a cron job.
	 */
	toCron() {
		const startHour = this.hours
		const startMin = this.minutes
		const startDay = this.day
		const startMonth = Number(
			format(this.parseTime, `M`),
		)
		const startDayOfMonth = Number(
			format(this.parseTime, `d`),
		)
		const cronStartTime = `${startMin} ${startHour} ${startDayOfMonth} ${startMonth} ${startDay}`
		return cronStartTime
	}

	/**
	 * Creates a Cron Job time for 2 minutes from the current time.
	 */
	rightNowToCron() {
		const rightNow = new Date()
		const futureRightNow = addMinutes(rightNow, 2) // # Add 2 minutes for functions & timing
		const rightNowMin = getMinutes(futureRightNow)
		const rightNowHour = getHours(rightNow)
		const rightNowDay = getDay(rightNow)
		const rightNowMonth = Number(format(rightNow, `M`))
		const rightNowDayOfMonth = Number(
			format(rightNow, `d`),
		)
		const cronStartTime = `${rightNowMin} ${rightNowHour} ${rightNowDayOfMonth} ${rightNowMonth} ${rightNowDay}`
		return cronStartTime
	}

	/**
	 * Validates that the date is a valid date.
	 * @returns {boolean} True if the date is valid, otherwise false.
	 */
	validate() {
		return isValid(this.parseTime)
	}

	/**
	 * For NFL:
	 * Identify if the time provided is before 1 PM (EST)
	 * @returns {boolean} True if the time is before 1 PM, otherwise false.
	 */
	isBefore1PM() {
		const time = this.parseTime
		const onePM = new Date()
		onePM.setHours(13)
		return isBefore(time, onePM)
	}

	isBefore() {
		return isBefore(this.parseTime, new Date())
	}

	isSameWeek() {
		return isSameWeek(this.parseTime, new Date(), {
			weekStartsOn: 3,
		})
	}
}
