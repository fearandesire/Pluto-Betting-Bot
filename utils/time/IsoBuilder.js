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
} from 'date-fns'

export default class IsoBuilder {
    /**
     * Creates a new instance of IsoBuilder with the given time.
     * @param {string} time - A string representing a valid date and time in ISO format.
     */
    constructor(time) {
        this.parseTime = parseISO(time)
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
    isPast() {
        return isAfter(this.parseTime, new Date())
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
        const startHour = getHours(this.parseTime)
        const startMin = getMinutes(this.parseTime)
        const startDay = getDay(this.parseTime)
        const startMonth = Number(format(this.parseTime, `M`))
        const startDayOfMonth = Number(format(this.parseTime, `d`))
        const cronStartTime = `${startMin} ${startHour} ${startDayOfMonth} ${startMonth} ${startDay}`
        return cronStartTime
    }

    /**
     * Validates that the date is a valid date.
     * @returns {boolean} True if the date is valid, otherwise false.
     */
    validate() {
        return isValid(this.parseTime)
    }
}
