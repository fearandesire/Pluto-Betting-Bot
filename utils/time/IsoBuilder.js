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
} from 'date-fns'

export default class IsoBuilder {
    /**
     * Creates a new instance of IsoBuilder with the given time.
     * @param {string} time - A string representing a valid date and time in ISO format.
     */
    constructor(time) {
        this.parseTime = parseISO(time)
        this.tday = new Date()
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
        const startHour = getHours(this.parseTime)
        const startMin = getMinutes(this.parseTime)
        const startDay = getDay(this.parseTime)
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
}
