import { db } from '#db'
import { dmMe } from '../../bot_res/dmMe.js'
import { flatcache } from '#config'
import { msgBotChan } from '#botUtil/msgBotChan'

export async function removeAllMatchups() {
    await db
        .oneOrNone(`DELETE FROM "activematchups"`)
        .catch(() =>
            msgBotChan(`Issue occured deleting matchups from DB.`, `error`),
        )
    var oddsCache = flatcache.create(`oddsCache.json`, './cache/dailyOdds')
    var matchupCache = oddsCache.getKey(`matchups`)
    if (!matchupCache || Object.keys(matchupCache).length === 0) {
        await dmMe(
            `Unable to delete matchups from cache, but the database has been cleared.`,
            `error`,
        )
        return
    }
    await oddsCache.removeKey(`matchups`)
    oddsCache.save(true)
    await dmMe(`Successfully cleared all matchups in the DB & cache`)
    return
}
