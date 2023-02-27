/**
 * @fileoverview Utility functions to assist with API, DB and Cron Jobs
 *
 */

import { format } from 'date-fns'
import cronstrue from 'cronstrue'
import { Log } from '#colors'

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
