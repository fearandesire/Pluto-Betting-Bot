import { Log, _, flatcache } from '#config'

export async function gameDaysCache(dayName) {
    let gameDays
    var gameDayCache = flatcache.create('gameDaysCache.json', './cache/')
    if (gameDayCache.getKey('gameDays') == undefined) {
        gameDays = gameDayCache.setKey(`gameDays`, [])
        gameDayCache.save(true)
        Log.Yellow(`Created Game Days Cache`)
        return gameDays
    } else if (_.includes(gameDayCache.getKey('gameDays'), dayName)) {
        Log.Yellow(`Game Day Already Exists in Cache`)
        return
    } else {
        gameDays = gameDayCache.getKey('gameDays')
        gameDays.push(dayName)
        gameDayCache.save(true)
        Log.Green(`Added ${dayName} to Game Days Cache: ${gameDays}`)
        return
    }
}
