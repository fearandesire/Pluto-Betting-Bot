import { db } from '#db'
import dmMe from '../../bot_res/dmMe.js'
import { flatcache, LIVEMATCHUPS } from '#config'

export async function removeAllMatchups() {
    await db
        .oneOrNone(`DELETE FROM "${LIVEMATCHUPS}"`)
        .catch(
            async () =>
                await dmMe(`Issue occured deleting matchups from DB.`, `error`),
        )
    const oddsCache = flatcache.create(`oddsCache.json`, './cache/dailyOdds')
    const matchupCache = oddsCache.getKey(`matchups`)
    if (!matchupCache || Object.keys(matchupCache).length === 0) {
        await dmMe(`Matchups removed from the DB.\nCache was empty.`)
        return
    }
    await oddsCache.removeKey(`matchups`)
    oddsCache.save(true)
    await dmMe(`Successfully cleared all matchups in the DB & cache`)
}
