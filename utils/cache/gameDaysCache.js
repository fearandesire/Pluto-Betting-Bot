import { Log, _, flatcache } from '#config'

/**
 * @module gameDaysCache
 * Manages the 'game days' cache - A cache system being used to know what days we have games. This is used to provide daily information of how many game channels are being scheduled day-to-day
 * @param {string} dayName - The name of the day of the week (Sunday, Monday, etc)
 */
export async function gameDaysCache(dayName) {
	const gameDayCache = flatcache.create('gameDaysCache.json', './cache/')
	if (gameDayCache.getKey('gameDays') === undefined) {
		var gameDays = gameDayCache.setKey(`gameDays`, [])
		gameDayCache.save(true)
		Log.Yellow(`Created Game Days Cache`)
		return gameDays
	}
	if (_.includes(gameDayCache.getKey('gameDays'), dayName)) {
		Log.Yellow(`Game Day Already Exists in Cache`)
	} else {
		gameDays = gameDayCache.getKey('gameDays')
		gameDays.push(dayName)
		gameDayCache.save(true)
		Log.Green(`Added ${dayName} to Game Days Cache: ${gameDays}`)
	}
}
