import { _, flatcache } from '#config'

import { resolveMatchupLog } from '../logging.js'

/**
 * Return matchup information from the CACHE.
 * @param {ParamDataTypeHere} parameterNameHere - Brief description of the parameter here. Note: For other notations of data types, please refer to JSDocs: DataTypes command.
 * @return {ReturnValueDataTypeHere} Brief description of the returning value here.
 */

export function resolveMatchup(teamName, reqInfo) {
    let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')
    var weeklyOdds = oddsCache.getKey(`matchups`)
    resolveMatchupLog.info(`Searching for: ${teamName} in cache`)
    let hOrAway
    let matchedInfo
    if (!weeklyOdds || Object.keys(weeklyOdds).length === 0) {
        resolveMatchupLog.error(`Unable to locate weekly odds in cache.`)
        return false
    }
    var matchupInfo = _.find(weeklyOdds, function (o) {
        if (o.home_team === teamName) {
            hOrAway = `home`
            resolveMatchupLog.info({
                level: `info`,
                message: `Matchup found for ${teamName}`,
                matchupInfo: o,
            })
            return o
        } else if (o.away_team === teamName) {
            hOrAway = `away`
            resolveMatchupLog.info({
                level: `info`,
                message: `Matchup found for ${teamName}`,
                matchupInfo: o,
            })
            return o
        }
    })
    if (!matchupInfo) {
        resolveMatchupLog.error(`Unable to locate a matchup for team ${teamName}`)
        return false
    } else if (reqInfo === 'odds') {
        if (hOrAway === 'home') {
            matchedInfo = matchupInfo.home_teamOdds
            return matchedInfo
        } else if (hOrAway === 'away') {
            matchedInfo = matchupInfo.away_teamOdds
            return matchedInfo
        }
    } else {
        return matchupInfo
    }
}
