import flatcache from 'flat-cache'
import { db } from '#db';
import cronstrue from 'cronstrue';

/**
 * @module scheduleArr
 * Return the array of schedule games from cache. If it doesn't exist yet, this will create it.
 * @returns {array} Return an empty array, or the array of games themselves.
 */

export async function fetchScheduleArr() {
    const schCache = await flatcache.create(
        `scheduleArr.json`,
        `./cache/scheduleArr`,
    )
    let schArr = (await schCache.getKey(`scheduleArr`)) || null
    if (!schArr) {
        await schCache.setKey(`scheduleArr`, [])
        await schCache.save(true)
        schArr = await schCache.getKey(`scheduleArr`)
    }
    return schArr
}
