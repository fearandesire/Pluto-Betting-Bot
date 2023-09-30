/**
 * A module for managing ISO formatted dates.
 * @module IsoManager
 */
import IsoBuilder from './IsoBuilder.js'

export default class IsoManager {
	/**
	 * Creates a new instance of IsoManager with the given time.
	 * @param {string} time - A string representing a valid date and time in ISO format.
	 */
	constructor(time, compare) {
		const builder =
			new IsoBuilder(time, compare) || null

		/**
		 * Filter within NFL Week
		 * @type {boolean}
		 */
		this.nflWeek = builder.withinNFLWeek()

		/**
		 * Filter within this week
		 * @type {boolean}
		 */
		this.sevenDayWeek = builder.withinThisWeek()

		/**
		 * The date formatted as "MM/dd/yyyy".
		 * @type {string}
		 */
		this.mdy = builder.format(`MM/dd/yyyy`)

		/**
		 * The date formatted as "EEE, h:mm a".
		 * @type {string}
		 */
		this.legible = builder.format(`EEE, h:mm a`)

		this.timeOnly = builder.format('h:mm a')
		/**
		 * Determines whether the date is in the past.
		 * @returns {boolean} True if the date is in the past, otherwise false.
		 * @type {boolean}
		 */
		this.isInPast = builder.isInPast()

		/**
		 * Determines whether the date is today.
		 * @type {boolean}
		 */
		this.today = builder.isToday()

		/**
		 * The name of the day of the week.
		 * @type {string}
		 */
		this.dayName = builder.format(`EEEE`)

		/**
		 * The date formatted as a cron job.
		 * @type {string}
		 */
		this.cron = builder.toCron()

		/** @type {string} Cron Job of current time + 1 minute */
		this.cronRightNow = builder.rightNowToCron()

		/**
		 * Checks if the date is before 1 PM
		 * @type {boolean}
		 */
		this.before1PM = builder.isBefore1PM()

		/**
		 * Determines whether the date is before the current time.
		 */
		this.isBefore = builder.isBefore()

		/**
		 *  Determines whether the date is after the current time.
		 */
		this.isAfter = builder.isAfter()

		/**
		 *
		 * @type {boolean}
		 * @returns {boolean} True - Same Week | False - Different Week
		 */
		this.isSameWeek = builder.isSameWeek()

		/**
		 * @type {boolean}
		 * @returns {boolean} True - Same Day | False - Different Day
		 */
		this.isSameDay = builder.isMatchingDate()
	}
}
