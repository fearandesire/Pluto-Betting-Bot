import { flatcache } from '#config'

import { db } from '#db'
import { msgBotChan } from '../bot_res/send_functions/msgBotChan.js'

export async function removeAllMatchups() {
	await db
		.oneOrNone(`DELETE FROM activematchups`)
		.catch(() =>
			msgBotChan(`Issue occured deleting matchups from DB.`, `error`),
		)
	var oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')
	var matchupCache = oddsCache.getKey(`matchups`)
	if (!matchupCache || Object.keys(matchupCache).length === 0) {
		msgBotChan(
			`Unable to delete matchups from cache, but the database has been cleared.`,
			`error`,
		)
		return
	}
	await oddsCache.removeKey(`matchups`)
	oddsCache.save(true)
	msgBotChan(`Successfully cleared all matchups in the DB & cache`)
	return
}
