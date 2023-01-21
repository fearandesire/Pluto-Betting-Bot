import { Log, LIVEMATCHUPS, container } from '#config'
import cronstrue from 'cronstrue'
import { db } from '#db'
import cronParser from 'cron-parser'
import _ from 'lodash'
import { dmMe } from '../../bot_res/dmMe.js'
import { memUse } from '#mem'
import { resolveToday } from '#dateUtil/resolveToday'
import stringifyObject from 'stringify-object'

import { format, isLastDayOfMonth, addMonths, startOfMonth } from 'date-fns'

/**
 * @module resolveCompCron
 * 
 * @summary Generates the Cron Jobs to center our API calls for completed games ({@link checkCompleted}) around them. [resolveCompCron > resolve Completed Check Cron].

* @description  This function will check the Cron strings for potential cases of cron related errors from invalid time strings.
 * The necessity of this function is to create blocks of time where API requests are made.
 *  Confining API calls in a range will limit the use of it, creating a more efficient use of the API, and most importantly, maintain the costs.

* @returns {Object} - Object containing the ranges of the Cron Jobs that will be used in {@link completedReq}
 */

export async function resolveCompCron() {
    await memUse(`resolveCompCron`, `Pre-Cron Range`)
    var todaySlash = await new resolveToday().todayFullSlashes
    todaySlash = todaySlash.toString()
    let res = {}
    return await db
        .manyOrNone(
            `SELECT * FROM "${LIVEMATCHUPS}" WHERE dateofmatchup = $1 ORDER BY "startTime" ASC`,
            [todaySlash],
        ) // ? Fetches matchups for the day, sorted the time they start
        .then(async (data) => {
            if (!data || data.length === 0) {
                Log.Red(`[resolveCompCron.js] No games scheduled today`)
                return false
            }
            var earliestCron = data[0].cronstart
            var latestCron = data[data.length - 1].cronstart
            const earliest = await cronDate(earliestCron)
            const latest = await cronDate(latestCron)
            let dbCron = {
                [`earliest`]: {
                    full: earliest,
                    hour: earliest.split('-')[1],
                    minute: earliest.split('-')[2],
                    dayOfMonth: earliest.split('-')[3],
                    dayOfWeek: earliest.split('-')[4],
                },
                [`latest`]: {
                    full: latest,
                    hour: latest.split('-')[1],
                    minute: latest.split('-')[2],
                    dayOfMonth: latest.split('-')[3],
                    dayOfWeek: latest.split('-')[4],
                },
            }
            // # Convert every property in `dbCron` to a number w. Lodash
            dbCron = _.mapValues(dbCron, (value) => {
                return _.mapValues(value, (value) => {
                    return Number(value)
                })
            })
            const { earliest: dbearly, latest: dblate } = dbCron
            let firstHour = dbCron.earliest.hour
            let lastHour = dbCron.latest.hour
            let oneGame = firstHour === lastHour ? true : false
            const cMonth = earliest.split('-')[0]
            // ? Obj to supply with Cron-type strings to build the ranges.
            const newRanges = {
                [`earliest`]: {
                    cronHour: ``,
                    newDate: ``,
                    month: cMonth,
                    dayOfMonth: dbearly.dayOfMonth,
                    dayOfWeek: dbearly.dayOfWeek,
                },
                [`latest`]: {
                    cronHour: ``,
                    newDate: ``,
                    month: cMonth,
                    dayOfMonth: dblate.dayOfMonth,
                    dayOfWeek: dblate.dayOfWeek,
                },
            }
            const { earliest: e, latest: l } = newRanges

            // # Determine when we will start the Cron Jobs to check for completed games
            switch (true) {
                // # 24 Hour Format
                case firstHour >= 22:
                    e.cronHour = `0-4`
                    l.dayOfMonth += 1
                    l.dayOfWeek += 1
                    break

                case firstHour === 21:
                    e.cronHour = `0-4`
                    l.dayOfMonth += 1
                    l.dayOfWeek += 1
                    break

                default:
                    e.cronHour = `${firstHour}-${firstHour + 3}`
                    break
            }
            switch (true) {
                case lastHour >= 21 && !oneGame && e.cronHour !== `0-4`:
                    l.cronHour = `0-4`
                    l.dayOfMonth += 1
                    l.dayOfWeek += 1
                    break
                default:
                    l.cronHour = `${lastHour}-${lastHour + 4}`
                    break
            }
            const today = new Date(todaySlash)
            const endOfMonth = isLastDayOfMonth(today)
            if (endOfMonth) {
                // ? Case for: Late-Night Games on days that are on the last day of the month - Using date-fns to make it easy to move timers to the next day.
                if (firstHour >= 21) {
                    // # Add 1 day
                    e.newDate = startOfMonth(addMonths(today, 1))
                    // # Fill in dayOfMonth and dayOfWeek from the new date
                    e.dayOfMonth = format(e.newDate, 'd')
                    e.dayOfWeek = format(e.newDate, 'E')
                    // # Update the month
                    e.month = format(e.newDate, 'M')
                }
                // ? Case for: More than 1 game being past 9PM on the last day of the month
                if (lastHour >= 21 && !oneGame) {
                    l.dayOfMonth = e.dayOfMonth
                    l.dayOfWeek = e.dayOfWeek
                    l.month = e.month
                }
            }
            newRanges.range1 = `*/5 ${e.cronHour} ${e.dayOfMonth} ${e.month} ${e.dayOfWeek}`
            if (!oneGame) {
                newRanges.range2 = `*/5 ${l.cronHour} ${l.dayOfMonth} ${l.month} ${l.dayOfWeek}`
            }
            res.range1 = '45 11 * * *'
            res.range2 = '46 11 * * *'
            const rangesEnglish = `[resolveCompCron.js] Earliest Game Time Today: ${cronstrue.toString(
                earliestCron,
            )} || Latest Game Time Today: ${cronstrue.toString(latestCron)}`
            await console.log(rangesEnglish)
            await dmMe(`Today's Cron Ranges:\n\`\`\`js
            ${stringifyObject(res)}
            \`\`\``)
            return res
        })
        .catch(async (err) => {
            await Log.Red(`[resolveCompCron.js] ERROR: ${err}`)
        })
}

/**
 * @function cronDate
 * Takes a Cron String and returns it in a formal date format using cronParser
 */
function cronDate(cronStr) {
    const parsed = cronParser.parseExpression(cronStr)
    const nextInter = parsed.next()
    let date = nextInter.getTime()
    date = format(date, 'M-HH-mm-dd-ee') // ? date-fns to format the date. M-HH-mm-dd-ee = Month-Hour-Minute-DayOfMonth-DayOfWeek
    return date
}
