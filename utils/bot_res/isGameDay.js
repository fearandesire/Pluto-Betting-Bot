import { Log, _ } from '#config'

import flatcache from 'flat-cache'
import { resolveDayName } from './resolveDayName.js'

/**
 * @module isGameDay
 * Check if today is a game day. If it is, return true. If not, return false.
 */

export async function isGameDay() {
    var todaysDay = new Date().getDay()
    var dayOfWeek = await resolveDayName(todaysDay)
    var gameDayCache = flatcache.load('gameDaysCache.json', './cache/')
    var gameDays = gameDayCache.getKey('gameDays')
    //# iterate game days cache and check if today is a game day
    if (_.includes(gameDays, dayOfWeek)) {
        Log.Green(`[isGameDay.js] Today is a game day`)
        return true
    } else {
        Log.Red(`[isGameDay.js] Today is not a game day`)
        return false
    }
}
