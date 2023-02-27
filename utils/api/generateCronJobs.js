import { parseISO } from 'date-fns'
import cron from 'node-cron'
import _ from 'lodash'
import { formatRange, logCron } from './apiUtils.js'
import { checkCompleted } from './checkCompleted.js'
import { fetchTodaysMatches, rangeManager } from '#matchMngr'
import dmMe from '#utilBot/dmMe'

/**
 * Generates two cron jobs based on the start times of matches in the given array.
 * @param {Array} todaysMatches - An array of match objects, each containing properties for 'teamOne', 'teamTwo', 'teamOneOdds', 'teamTwoOdds', 'matchupId', 'gameDate', 'startTime', 'cronStartTime', and 'legibleStartTime'.
 * @returns {Promise<Array>} A promise that resolves to an array of the two CronJob instances that were created and started.
 * @example
 * generateCronJobs([
 *   { teamOne: 'Barcelona', teamTwo: 'Real Madrid', startTime: '2022-02-24T20:00:00Z' },
 *   { teamOne: 'Manchester United', teamTwo: 'Liverpool', startTime: '2022-02-24T22:00:00Z' },
 * ]);
 */

export default async function generateCronJobs(matches) {
    const todaysMatches = matches || (await fetchTodaysMatches())
    if (!todaysMatches) {
        return false
    }
    const earliestGame = todaysMatches[0]
    const latestGame = todaysMatches[todaysMatches.length - 1]
    const earliestGameStart = parseISO(earliestGame.startTime)
    const latestGameStart = parseISO(latestGame.startTime)
    const earliestDayNum = earliestGameStart.getDate()
    let latestDayNum = latestGameStart.getDate()
    const minInterval = '*/5'
    const earliestHour = earliestGameStart.getHours()
    const latestHour = latestGameStart.getHours()
    let latestHourString
    const earliestHourString = `${earliestHour}-${earliestHour + 3}`
    // # Increment the day, hour string should be 0-3
    if (latestHour > 20) {
        const nextDay = new Date(latestGameStart)
        latestDayNum = nextDay.getDate() + 1
        latestHourString = `0-3`
    } else {
        latestHourString = `${latestHour}-${latestHour + 3}`
    }
    const monthNum = `${new Date().getMonth() + 1}`
    const range1 = `${minInterval} ${earliestHourString} ${earliestDayNum} ${monthNum} *`
    const range2 = `${minInterval} ${latestHourString} ${latestDayNum} ${monthNum} *`
    const title = `generateCronJobs`
    const msg = `Checking for completed matches.`

    try {
        cron.schedule(range1, async () => {
            logCron({
                title,
                msg,
            })
            await checkCompleted()
        })

        cron.schedule(range2, async () => {
            logCron({
                title,
                msg,
            })
            await checkCompleted()
        })
        await rangeManager({ post: true, r1: range1, r2: range2 })
        const rangeObj = {
            range1,
            range2,
        }
        return Promise.resolve(rangeObj)
    } catch (error) {
        console.error(`Error during generateCronJobs:`, error)
        throw Promise.reject(error)
    }
}
