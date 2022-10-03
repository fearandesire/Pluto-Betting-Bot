import flatcache from 'flat-cache'
import { resolveToday } from '#dateUtil/resolveToday'

/**
 * @module sentSchEmb
 * Verify if we have already sent the schedule queue embed for the day
 */

export async function sentSchEmb() {
    var todayInfo = await new resolveToday()
    var cache = flatcache.create(`sentSchEmb.json`, `./cache/`)
    if (cache.getKey(todayInfo.todayFullEasy) !== true) {
        cache.setKey(todayInfo.todayFullEasy, true)
        cache.save(true)
        return false
    } else {
        return true
    }
}
