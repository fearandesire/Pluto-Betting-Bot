import { NBA_ACTIVEMATCHUPS, QuickError, embedReply } from '#config'

import { db } from '#db'
import { formatOdds } from '#cmdUtil/formatOdds'

/**
 * @module returnDailyOdds
 * Return the matchups & odds for the day
 */

export async function returnDailyOdds(message, interactionEph) {
    var oddsFields = []
    var matchupDb = await db.manyOrNone(`SELECT * FROM "${NBA_ACTIVEMATCHUPS}"`)
    if (!matchupDb || Object.keys(matchupDb).length === 0) {
        QuickError(message, 'No odds available to view.')
        return
    }
    //# iterate through matchupDB with a for loop so we can access the values of each nested object
    for (const key in matchupDb) {
        var match = matchupDb[key]
        var hTeam = match.teamone
        var aTeam = match.teamtwo
        var hOdds = match.teamoneodds
        var aOdds = match.teamtwoodds
        var startTime = match.legiblestart
        let oddsFormat = await formatOdds(hOdds, aOdds)
        hOdds = oddsFormat.homeOdds
        aOdds = oddsFormat.awayOdds
        oddsFields.push({
            name: `• ${startTime}`,
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
        color: `#00ffff`,
        title: `:scroll: Daily H2H Odds`,
        fields: oddsFields,
        thumbnail: `${process.env.sportLogoNBA}`,
        footer:
            'Favored teams have a - negative number | Pluto - Designed by FENIX#7559',
    }
    embedReply(message, embedObj, interactionEph)
}
