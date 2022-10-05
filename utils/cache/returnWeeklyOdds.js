import { QuickError, embedReply, flatcache } from '#config'

import { formatOdds } from '#cmdUtil/formatOdds'

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
    //# iterate through matchupCache with a for loop so we can access the values of each nested object
    for (const key in matchupCache) {
        var matchFound = matchupCache[key]
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
    }
    //# count # of objects in oddsFields - if the # is not divisible by 3, turn the last inline field to false
    var oddsFieldCount = oddsFields.length
    if (oddsFieldCount % 3 !== 0) {
        oddsFields[oddsFieldCount - 1].inline = false
    }
    console.log(oddsFields)
    var embedObj = {
        title: `Weekly H2H Odds`,
        fields: oddsFields,
        footer:
            'Favored teams have a - negative number | Pluto - Designed by FENIX#7559',
    }
    embedReply(message, embedObj, interactionEph)
}