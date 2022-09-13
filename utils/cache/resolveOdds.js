import { flatcache, _ } from '#config'

import { resolveOddsLog } from '../logging.js'

/**
 * Return matchup odds information from the CACHE based on team name provided
 * @param {ParamDataTypeHere} parameterNameHere - Brief description of the parameter here. Note: For other notations of data types, please refer to JSDocs: DataTypes command.
 * @return {ReturnValueDataTypeHere} Brief description of the returning value here.
 */

export function resolveOdds(teamName) {
	let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')
	var weeklyOdds = oddsCache.getKey(`matchups`)
	console.log(`Searching for: ${teamName}`)
	if (!weeklyOdds || Object.keys(weeklyOdds).length === 0) {
		resolveOddsLog.error(`Unable to locate weekly odds in cache.`)
		return false
	}
	var matchupInfo = _.find(weeklyOdds, function (o) {
		if (o.home_team === teamName) {
			resolveOddsLog.info({
				level: `info`,
				message: `Matchup found for ${teamName}`,
				matchupInfo: o,
			})
			return o.home_teamOdds
		}
		if (o.away_team === teamName) {
			resolveOddsLog.info({
				level: `info`,
				message: `Matchup found for ${teamName}`,
				matchupInfo: o,
			})
			return o.away_teamOdds
		}
	})
	if (!matchupInfo) {
		resolveOddsLog.error(`Unable to locate a matchup for team ${teamName}`)
		return false
	} else {
		return matchupInfo
	}
}
