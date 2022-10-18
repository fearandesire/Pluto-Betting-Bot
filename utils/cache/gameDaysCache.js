import { Log, flatcache } from '#config'

export async function gameDaysCache(dayName) {
    var gameDayCache = flatcache.create('gameDaysCache.json', './cache/')
    if (gameDayCache.getKey('gameDays') == undefined) {
        var gameDays = gameDayCache.setKey(`gameDays`, [])
        gameDayCache.save(true)
        Log.Yellow(`Created Game Days Cache`)
        return gameDays
    } else {
        gameDays = gameDayCache.getKey('gameDays')
        gameDayCache.push(dayName)
        gameDayCache.save(true)
        Log.Green(`Added ${dayName} to Game Days Cache: ${gameDays}`)
        return
    }
}
