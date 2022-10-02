import flatcache from 'flat-cache'
import { trackProgressLog } from '../../logging.js'

/**
 * @module returnProgress
 * Check cache for match in progress. If it exists, return true. If not, return false
 */
export async function returnProgress(matchId) {
    return new Promise((resolve, reject) => {
        const cache = flatcache.create(`inProgress.json`, `./cache/`)
        var matchIdCache = cache.getKey(`${matchId}`)
        if (matchIdCache !== undefined && matchIdCache == true) {
            trackProgressLog.info(`Match ${matchId} is in progress`)
            resolve(true)
        } else {
            trackProgressLog.info(`Match ${matchId} is not in progress`)
            resolve(false)
        }
    })
}
