import flatcache from 'flat-cache'
import { removeMatchLog } from '../../logging.js'

/**
 * @module removeMatchupCache
 * Remove a matchup from the cache
 */

export async function removeMatchupCache(matchId) {
    var oddsCache = flatcache.create('oddsCache.json', './cache/weeklyOdds')
    var matchupCache = oddsCache.getKey('matchups')
    if (!matchupCache || Object.keys(matchupCache).length === 0) {
        removeMatchLog.error(`Unable to locate weekly odds in cache.`)
        return false
    }
    try {
        delete matchupCache[matchId]
        oddsCache.save(true)
        removeMatchLog.info(`Successfully removed ${matchId} from the cache`)
        return true
    } catch (err) {
        removeMatchLog.error(`Error occured removing ${matchId} from the cache.`)
        return false
    }
}
