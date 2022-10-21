import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveToday } from './resolveToday.js'

/**
 * @module gameActive.js
 * Resolve game time from cache and compare it to the current time. Reject if the game has already started
 * @description - A current date vs Game Date comparison is written with the day, hour and minute all combined.
 * #For example: 15330 (15th of the month - 3 PM the hour - 30 past 3 PM)
 * @param {string} teamName - The team name we will check the matchup for to see if the game has started
 * @return {boolean} Returns true or false depending on if the game is active, or not.
 */

export async function gameActive(teamName) {
    var match = await resolveMatchup(teamName)
    var matchDay = match.dayNum
    var matchHour = match.hour
    var matchMinute = match.minute
    var todayDateInfo = await new resolveToday()
    //console.log(todayDateInfo)
    var currentDay = todayDateInfo.todaysDate.dayNum
    var currentHour = todayDateInfo.hour
    var currentMinute = todayDateInfo.minute
    console.log(
        `${teamName} Match Details:\nDay: ${matchDay}\nHour: ${matchHour}\nMinute: ${matchMinute}`,
    )
    console.log(
        `Current Details:\nDay: ${currentDay}\nHour: ${currentHour}\nMinute: ${currentMinute}`,
    )
    if (currentDay === matchDay) {
        if (currentHour > matchHour) {
            //# hour is currently past game time
            return false
        } else if (currentHour === matchHour) {
            //# hour matches, lets verify the minutes
            if (currentMinute > matchMinute) {
                //# game has already started
                return false
            }
        } else {
            return false
        }
    }
    if (currentDay > matchDay) {
        return false
    }
    if (currentDay < matchDay) {
        return false
    }
}
