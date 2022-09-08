/**
 * Retrieve All Matchup IDs. Matchup IDs are stored into cache when the odds are gathered, so that is where we will retrieve them from.
 * @param {object} message - The Discord message object
 * @return {Array} Returns an array containing all of the active/current matchup IDs
 */

import _ from 'lodash'
import flatcache from 'flat-cache'

let oddsCache = flatcache.create(`oddsCache.json`, './cache/todaysOdds')
export function fetchAllMatchIds(message) {
    let allMatchups = []
    let allMatchupsCache = oddsCache.getKey('matchups')
    _.forIn(allMatchupsCache, function (matchups, key) {
        //console.log(matchups)
        allMatchups.push(matchups.matchupId)
    })
    return allMatchups
}
