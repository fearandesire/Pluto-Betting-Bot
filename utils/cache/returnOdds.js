import { MessageEmbed } from 'discord.js'
import { LIVEMATCHUPS, QuickError, embedReply } from '#config'

import { db } from '#db'
import { formatOdds } from '#cmdUtil/formatOdds'

/**
 * @module returnOdds
 * Return all currently available odds from the database
 */

export async function returnOdds(interaction, interactionEph) {
    const oddsFields = []
    const matchupDb = await db.manyOrNone(`SELECT * FROM "${LIVEMATCHUPS}"`)
    if (!matchupDb || Object.keys(matchupDb).length === 0) {
        await QuickError(interaction, 'No odds available to view.')
        return
    }
    // # iterate through matchupDB with a for loop so we can access the values of each nested object
    for (const key in matchupDb) {
        const match = matchupDb[key]
        const hTeam = match.teamone
        const aTeam = match.teamtwo
        let hOdds = match.teamoneodds
        let aOdds = match.teamtwoodds
        const startTime = match.legiblestart
        const oddsFormat = await formatOdds(hOdds, aOdds)
        hOdds = oddsFormat.homeOdds
        aOdds = oddsFormat.awayOdds
        oddsFields.push({
            name: `• ${startTime}`,
            value: `**${hTeam}**\nOdds: *${hOdds}*\n**${aTeam}**\nOdds: *${aOdds}*\n──────`,
            inline: true,
        })
    }
    // # count # of objects in oddsFields - if the # is not divisible by 3, turn the last inline field to false
    const oddsFieldCount = oddsFields.length
    if (oddsFieldCount % 3 !== 0) {
        oddsFields[oddsFieldCount - 1].inline = false
    }
    //   console.log(oddsFields)
    const embedObj = {
        color: `#00ffff`,
        title: `:mega: H2H Odds`,
        fields: oddsFields,
        thumbnail: {
            url: `${process.env.sportLogo}`,
        },
        footer: {
            text: `Odds are subject to change. | ${oddsFieldCount} games available to bet on.`,
        },
    }
    await interaction.followUp({ embeds: [new MessageEmbed(embedObj)] })
}
