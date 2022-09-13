import { flatcache } from '#config'

/**
 * Store start time of a game into cache
 * @param {string} isoDate - API Game Start Time (ISO format)
 */

export function storeStartTime(isoDate) {
	const oddsCache = flatcache.load('oddsCache.json', './cache/weeklyOdds')
}
