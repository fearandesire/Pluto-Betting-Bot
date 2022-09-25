import { QuickError, _, embedReply, flatcache } from '#config'

import { formatOdds } from '../bot_res/formatOdds.js'

/**
 * @module returnWeeklyOdds
 * Return the matchups & odds for the week
 */

export async function returnWeeklyOdds(message, interactionEph) {
    let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')
    var matchupCache = oddsCache.getKey(`matchups`)
    if (!matchupCache || Object.keys(matchupCache).length === 0) {
        QuickError(message, 'No odds available to view.')
        return
    }
    var oddsFields = []
    await _.forEach(matchupCache, async (matchFound) => {
        var hTeam = matchFound.home_team
        var aTeam = matchFound.away_team
        var hOdds = matchFound.home_teamOdds
        var aOdds = matchFound.away_teamOdds
        var matchupId = matchFound.matchupId
        var dateTitle = matchFound.dateView
        let oddsFormat = await formatOdds(hOdds, aOdds)
        hOdds = oddsFormat.homeOdds
        aOdds = oddsFormat.awayOdds
        oddsFields.push({
            name: `• ${dateTitle}`,
            value: `**${hTeam}**\nOdds: *${hOdds}*\n**${aTeam}**\nOdds: *${aOdds}*\n──────`,
            inline: true,
        })
    })
    var embedObj = {
        title: `Weekly H2H Odds`,
        fields: oddsFields,
        footer:
            'Favored teams have a - negative number | Pluto - Designed by FENIX#7559',
    }
    embedReply(message, embedObj, interactionEph)
}
