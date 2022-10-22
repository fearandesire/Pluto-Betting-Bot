import { Log } from '#config'
import _ from 'lodash'
import flatcache from 'flat-cache'
import { removeMatchLog } from '../../logging.js'

/**
 * @module removeMatchupCache
 * Remove a matchup from the cache
 */

export async function removeMatchupCache(matchId) {
	Log.Yellow(`Removing matchup ${matchId} from cache`)
	let oddsCache = flatcache.create('oddsCache.json', './cache/dailyOdds')
	let matchupCache = oddsCache.getKey('matchups')
	if (!matchupCache || Object.keys(matchupCache).length === 0) {
		removeMatchLog.error(`Unable to locate weekly odds in cache.`)
		return false
	}
	try {
		//# find key in matchupCache containing the matchId
		var key = _.findKey(matchupCache, function (o) {
			return o.matchId == matchId
		})
		delete matchupCache?.[`${key}`]
		oddsCache.save(true)
		Log.Green(`Successfully removed matchup ${matchId} from cache`)
		removeMatchLog.info(`Successfully removed ${matchId} from the cache`)
		return true
	} catch (err) {
		Log.Red(`Error removing matchup from cache`, err)
		removeMatchLog.error(`Error occured removing ${matchId} from the cache.`)
		return false
	}
}
