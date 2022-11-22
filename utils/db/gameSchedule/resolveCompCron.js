import { Log, NFL_ACTIVEMATCHUPS, container } from '#config'

import { db } from '#db'
import { dmMe } from '../../bot_res/dmMe.js'
import { memUse } from '#mem'
import { resolveToday } from '#dateUtil/resolveToday'
import stringifyObject from 'stringify-object'

/**
 * @module resolveCompCron
 * Receive the earliest & latest times the games starts from the database today [resolve Completed Check Cron].
 * @returns {Object} - Returns the Cron String for the range of time to check for completed games.
 */

export async function resolveCompCron() {
    await memUse(`resolveCompCron.js`, `Pre-Cron Range`)
    var todaySlash = await new resolveToday().todayFullSlashes
    todaySlash = todaySlash.toString()
    Log.Green(`[resolveCompCron.js] Today is ${todaySlash}`)
    return await db
        .manyOrNone(
            `SELECT * FROM "${NFL_ACTIVEMATCHUPS}" WHERE dateofmatchup = $1 ORDER BY "startTime" ASC`,
            [todaySlash],
        )
        .then(async (data) => {
            //console.log(`DATA =>>`, data)
            if (!data || data.length === 0) {
                console.log(`[resolveCompCron.js] No Games Today`)
                return false
            }
            var earliestCron = data[0].cronstart
            var latestCron = data[data.length - 1].cronstart
            await console.log(
                `[resolveCompCron.js] (Cron) Earliest Game Time Today: ${earliestCron} || (Cron) Latest Game Time Today: ${latestCron}`,
            )
            //# Split the cron times by spaces and add 2 hours to the hour value [second index], then rejoin the string
            var earliestCronSplit = earliestCron.split(' ')
            var latestCronSplit = latestCron.split(' ')
            var earliestCronHour = Number(earliestCronSplit[1])
            var latestCronHour = Number(latestCronSplit[1])
            var overnight
            var overnightHours
            /*
            & Handle the cases where:
             - The hour is at or above 22
              -- If this is the case, we need to add 2 hours to the hour value, but also add 1 to the day value
               - The month must be taken into consideration with the day, as some months have 30 days, and some have 31
               - And in the event we are at the end of the month, we need to add 1 to the month value
             */
            //# array of all months with 30 days [numeral]
            var thirtyDayMonths = [4, 6, 9, 11]
            //# array of all months with 31 days [numeral]
            var thirtyOneDayMonths = [1, 3, 5, 7, 8, 10, 12]
            //# Day & Months from the Cron Start String
            var earlyCronDay = parseInt(earliestCronSplit[2])
            var earlyCronMonth = parseInt(earliestCronSplit[3])
            var lateCronDay = parseInt(latestCronSplit[2])
            var lateCronMonth = parseInt(latestCronSplit[3])
            var dayOfWeek = parseInt(earliestCronSplit[4])
            var hourRange
            var range1
            var range2
            var cronRanges
            //# Near-Midnight Hour >> 30 Day Month & at the end of the month
            if (
                earliestCronHour >= 22 &&
                earlyCronDay == 30 &&
                thirtyDayMonths.includes(earlyCronMonth)
            ) {
                earliestCronHour = 0
                earlyCronDay = `01`
                earlyCronMonth += 1
            } else if (
                latestCronHour >= 22 &&
                lateCronDay == 30 &&
                thirtyDayMonths.includes(lateCronMonth)
            ) {
                latestCronHour = 3
                lateCronDay = `01`
                lateCronMonth += 1
            }
            //# Near-Midnight Hour >> 31 Day Month & at the end of the month
            else if (
                earliestCronHour >= 22 &&
                earlyCronDay == 31 &&
                thirtyOneDayMonths.includes(earlyCronMonth)
            ) {
                earliestCronHour = 0
                earlyCronDay = `01`
                earlyCronMonth += 1
            } else if (
                latestCronHour >= 22 &&
                lateCronDay == 31 &&
                thirtyOneDayMonths.includes(lateCronMonth)
            ) {
                latestCronHour = 3
                lateCronDay = `01`
                lateCronMonth += 1
                overnight = true
            } //# standard Near-Midnight Hour games, not at the end of the month - Just adding the next day
            else if (earliestCronHour >= 22) {
                earliestCronHour = 0
                earlyCronDay += 1
            } else if (latestCronHour >= 22) {
                latestCronHour = 3
                lateCronDay += 1
                overnight = true
            }
            var forceOvernight = [21, 22, 23]
            await console.log(
                `Latest Cron Hour: ${latestCronHour} || Earliest Cron Hour: ${earliestCronHour}`,
            )
            if (
                (latestCronHour == 3 && overnight == true) ||
                (forceOvernight.includes(latestCronHour) &&
                    forceOvernight.includes(earliestCronHour))
            ) {
                hourRange = `${earliestCronHour + 2}-23`
                overnightHours = `0-3`
                earliestCronSplit[1] = hourRange
                earliestCronSplit[0] = `*/5`
                range1 = earliestCronSplit.join(' ')
                range2 = `*/5 0-3 ${lateCronDay} ${earlyCronMonth} ${dayOfWeek + 1}`
                await Log.Green(
                    `[resolveCompCron.js] (2) Cron Ranges:\nRange 1: ${range1}\nRange 2: ${range2}`,
                )
                container.cronRanges = {
                    range1: range1,
                    range2: range2,
                }
                await dmMe(
                    `Cron Ranges for Completed Games:\n${stringifyObject(
                        container.cronRanges,
                    )}`,
                )
                return {
                    range1: `${range1}`,
                    range2: `${range2}`,
                }
            } else {
                //# days with 1 game, or games start at the same time with no variation
                if (earliestCronHour == latestCronHour) {
                    if (latestCronHour == 20) latestCronHour = 23
                } else {
                    earliestCronHour == earliestCronHour
                    latestCronHour += 2
                }
                hourRange = `${earliestCronHour}-${latestCronHour}`
                earliestCronSplit[1] = hourRange
                //# Change the minute value to a 5 minute interval
                earliestCronSplit[0] = `*/5`
                //# Rejoin the split array into a string
                range1 = earliestCronSplit.join(' ')
                await console.log(`Cron Comp String:`, range1)
                await Log.Green(`[resolveCompCron.js] (1) Cron Ranges:\n${range1}`)
                container.cronRanges = {
                    range1: range1,
                }
                await dmMe(
                    `Cron Ranges for Completed Games:\n${stringifyObject(
                        container.cronRanges,
                    )}`,
                )
                return {
                    range1: range1,
                }
            }
        })
}
