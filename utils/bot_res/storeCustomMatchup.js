import { Log } from '@pluto-core-config'
import flatcache from 'flat-cache'

/**
 * @module storeCustomMatchup
 * Store the custom matchup in the cache with the standard schema as a regular matchup
 */

export async function storeCustomMatchup(matchupObj) {
	const oddsCache = flatcache.create(
		`oddsCache.json`,
		'./cache/dailyOdds',
	)
	const matchupCache = oddsCache.getKey('matchups')
	try {
		const matchId = matchupObj.matchupId
		matchupCache[matchId] = matchupObj
		oddsCache.save(true)
		// # store team names into custom teams cache
		const customTeamsCache = flatcache.create(
			`customTeamsCache.json`,
			'./cache/customTeams',
		)
		// # store custom team names
		const cstmObj = {
			[`home_team`]: matchupObj.home_team,
			[`away_team`]: matchupObj.away_team,
		}
		customTeamsCache.setKey(`${matchId}`, cstmObj)
		customTeamsCache.save(true)
		return true
	} catch (error) {
		Log.Red(error)
		return false
	}
}
