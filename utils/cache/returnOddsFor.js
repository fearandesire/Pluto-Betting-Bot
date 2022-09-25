import { QuickError, _, embedReply, flatcache } from '#config'

import { resolveTeam } from '#cmdUtil/resolveTeam'

/**
 * @module returnOddsFor
 * Return odds for a specified matchup / team from cache
 * @param {ParamDataTypeHere} parameterNameHere - Brief description of the parameter here. Note: For other notations of data types, please refer to JSDocs: DataTypes command.
 * @return {ReturnValueDataTypeHere} Brief description of the returning value here.
 */

export async function returnOddsFor(message, teamName, interactionEph) {
    let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')
    teamName = await resolveTeam(teamName)
    if (!teamName) {
        QuickError(message, 'Please specify a valid team to get odds for')
        return
    }
    console.log(teamName)
    var matchupCache = oddsCache.getKey(`matchups`)
    if (!matchupCache || Object.keys(matchupCache).length === 0) {
        QuickError(
            message,
            `No odds available for team ${teamName}`,
            interactionEph,
        )
        return
    }
    await _.forEach(matchupCache, (matches) => {
        //debugging: console.log(matches)
        if (matches.home_team === teamName || matches.away_team === teamName) {
            var hTome = matches.home_team
            var aTome = matches.away_team
            var hTomeOdds = matches.home_teamOdds
            var aTomeOdds = matches.away_teamOdds
            var isSilent = interactionEph ? true : false
            var embedObj = {
                title: `Matchup #${matches[`matchupId`]}`,
                description: `Home Team: **${hTome}** @ *${hTomeOdds}*\nAway Team: **${aTome}** @ *${aTomeOdds}*`,
                footer: `Team @ H2H Odds | Pluto - Designed by FENIX#7559`,
                silent: isSilent,
            }
            embedReply(message, embedObj)
        }
    })
}
