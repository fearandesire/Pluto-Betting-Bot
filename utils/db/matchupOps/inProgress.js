import flatcache from 'flat-cache'
import { trackProgressLog } from '../../logging.js'

/**
 * @module inProgress
 * Save match ID to cache when we initialize closing it to prevent from duplicate operations and erors
 */
export async function inProgress(matchId) {
    const cache = flatcache.create(`inProgress.json`, `./cache/`)
    cache.setKey(`${matchId}`, true)
    cache.save(true)
    trackProgressLog.info(`Match ${matchId} added to cache`)
    return
}
