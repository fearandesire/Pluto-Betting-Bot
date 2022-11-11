import { db } from '#db'
import { embedReply } from '#config'
import { resolveTeam } from '#cmdUtil/resolveTeam'

/**
 * @module returnOddsFor
 * Return odds for a specified matchup from the database
 * @param {object} interaction - The Discord message object
 * @param {string} team - The team to return odds for
 */

export async function returnOddsFor(interaction, teamName) {
    //# Get the full team name in case an abbreviation was used
    teamName = await resolveTeam(teamName)
    var matchup = await db.any(
        `
    SELECT * FROM "activematchups" WHERE teamone = $1 OR teamtwo = $1
    `,
        [teamName],
    )
    if (!matchup) {
        await interaction.reply({
            content: `No matchup found for ${teamName}`,
            ephemeral: true,
        })
        return
    } else {
        matchup = matchup[0]
        var hTome = matchup.teamone
        var aTome = matchup.teamtwo
        var hTomeOdds = matchup.teamoneodds
        var aTomeOdds = matchup.teamtwoodds
        var isSilent = interactionEph ? true : false
        var embedObj = {
            title: `Matchup #${matchup[`matchid`]}`,
            description: `Home Team: **${hTome}** @ *${hTomeOdds}*\nAway Team: **${aTome}** @ *${aTomeOdds}*`,
            footer: `Team @ H2H Odds | Pluto - Designed by FENIX#7559`,
            silent: isSilent,
        }
        await embedReply(interaction, embedObj)
    }
}
