import { Log, flatcache } from '#config'

export async function gameDaysCache(dayName) {
    var gameDayCache = flatcache.load('gameDaysCache.json', './cache/')
    if (gameDayCache.getKey('gameDays') == undefined) {
        var gameDays = gameDayCache.setKey(`gameDays`, [])
        Log.Yellow(`Created Game Days Cache: ${gameDays}`)
        return gameDays
    } else {
        gameDays = gameDayCache.getKey('gameDays')
        gameDays.push(dayName)
        Log.Green(`Added ${dayName} to Game Days Cache: ${gameDays}`)
        return
    }
}
