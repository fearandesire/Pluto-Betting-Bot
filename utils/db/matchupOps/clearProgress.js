import flatcache from 'flat-cache'
import { trackProgressLog } from '../../logging.js'

/**
 * @module clearProgress
 * Clear match ID from cache when we finish closing it
 */
export async function clearProgress(matchId) {
	const cache = flatcache.create(
		`inProgress.json`,
		`./cache/`,
	)
	cache.setKey(`${matchId}`, false)
	cache.save(true)
	trackProgressLog.info(
		`Match ${matchId} cleared from cache`,
	)
}
