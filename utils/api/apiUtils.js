/**
 * @fileoverview Utility functions to assist with API, DB and Cron Jobs
 *
 */

import {
    isToday,
    parseISO,
    format,
    getHours,
    getMinutes,
    getDay,
    isValid,
} from 'date-fns'
import _ from 'lodash'
import cronstrue from 'cronstrue'
import { Log } from '#colors'

/**
 * Converts an ISO date string to a date-fns format, with various formatting options.
 * @function isoManager
 * @param {string} time - The ISO date string to format.
 * @param {Object} options - An options object.
 * @param {boolean} [options.today] - If true, returns true if the input time is today's date, and false otherwise.
 * @param {boolean} [options.formatDate] - If true, formats the input time as a date in the 'MM/dd/yyyy' format.
 * @param {boolean} [options.formatTime] - If true, formats the input time as a string in the 'EEE, h:mm a' format (e.g. 'Thu, 8:15 PM').
 * @returns {boolean|string|null} If the `today` option is set to true, returns true if the input time is today's date, false otherwise. If the `formatDate` option is set to true, returns the input time formatted as a date in the 'MM/dd/yyyy' format. If the `formatTime` option is set to true, returns the input time formatted as a string in the 'EEE, h:mm a' format. If none of the options are set to true, returns null.
 *
 * @example
  // Returns '02/24/2023'
 * isoManager('2023-02-24T00:00:00.000Z', { formatDate: true })
 *
 * @example
  // Returns 'Thu, 8:15 PM'
 * isoManager('2023-02-24T20:15:00.000Z', { formatTime: true })
 */

export async function isoManager(time, options) {
    const { today, formatDate, formatTime } = options

    if (today) {
        const parsedTime = parseISO(time)
        return isToday(parsedTime)
    }

    if (formatDate) {
        const parsedTime = parseISO(time)
        return format(parsedTime, 'MM/dd/yyyy')
    }

    if (formatTime) {
        const parsedTime = parseISO(time)
        return format(parsedTime, 'EEE, h:mm a')
    }
    return null
}

const td = new Date()
export const MDY = format(td, 'MM/dd/yyyy')

export async function toMDY(dateItem) {
    const dateStr = await _.toString(dateItem)
    // Validate input date string
    if (!isValid(parseISO(dateStr))) {
        throw new Error('Invalid date string')
    }

    // Parse the input date string
    const dateObj = parseISO(dateStr)

    // Convert to M/D/Y format
    const date = format(dateObj, 'MM/dd/yyyy')

    return date
}
/**
 * Generate a cron job time string from a timestamp (e.g 2021-01-01T00:00:00.000Z)
 * @function isoToCron
 * @param timestamp - The timestamp to convert
 * @returns A cron job time string
 * @example
 * toCronTime('2021-01-01T00:00:00.000Z') // '0 0 0 1 1 *'
 */
export async function isoToCron(timestamp) {
    const gameTime = parseISO(timestamp)
    const startHour = getHours(gameTime)
    const startMin = getMinutes(gameTime)
    const startDay = getDay(gameTime)
    const startMonth = Number(format(gameTime, `M`))
    const startDayOfMonth = Number(format(gameTime, `d`))
    const cronStartTime = `${startMin} ${startHour} ${startDayOfMonth} ${startMonth} ${startDay}`

    // Return the cron job time string
    return cronStartTime
}

export const isoToDayOfWeek = (isoDate) => format(new Date(isoDate), 'EEEE')

export function formatRange(cronString) {
    const options = {
        use24HourTimeFormat: true,
    }
    const cronObject = cronstrue.toString(cronString, options)

    // Extract the day of the month from the cron string
    const dayOfMonth = cronString.split(' ')[2]

    // Use date-fns to get the day name from the day of the month
    const date = new Date()
    date.setDate(dayOfMonth)
    const dayOfWeek = format(date, 'EEEE')

    // Use regex to extract the parts we need from the cronObject string
    const re =
        /Every \d+ minutes?, between (\d+:\d+) and (\d+:\d+), on day \d+ of the month, only in (\w+)/
    const match = cronObject.match(re)
    const startTime = match[1]
    const endTime = match[2]
    const month = match[3]

    // Create the statement using the extracted parts
    const statement = `${dayOfWeek} | ${startTime}-${endTime} | ${month}`
    return statement
}

export const logCron = async (options) => {
    const { title, msg } = options
    await Log.BrightBlue(
        `Init New Cron Job -->\n[Title]: ${title}\n[Msg]: ${msg || 'N/A'}`,
    )
}
