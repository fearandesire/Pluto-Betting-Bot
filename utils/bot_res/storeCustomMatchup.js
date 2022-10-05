import { Log } from '#config'
import flatcache from 'flat-cache'

/**
 * @module storeCustomMatchup
 * Store the custom matchup in the cache with the standard schema as a regular matchup
 */

export async function storeCustomMatchup(matchupObj) {
    let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')
    let matchupCache = oddsCache.getKey('matchups')
    try {
        var matchId = matchupObj.matchupId
        matchupCache[matchId] = matchupObj
        oddsCache.save(true)
        //# store team names into custom teams cache
        let customTeamsCache = flatcache.create(
            `customTeamsCache.json`,
            './cache/customTeams',
        )
        //# store custom team names
        var cstmObj = {
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
