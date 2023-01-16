import { MessageEmbed } from 'discord.js'
import { SapDiscClient } from '#main'
import { findEmoji } from '../../bot_res/findEmoji.js'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { validateData } from './../validation/validateData.js'
import { LIVEBETS } from '#config'
import { resolveTeamColor } from '../../cmd_res/resolveTeam.js'
import { fetchGif } from '#utilBot/'
/**

 * @module gameEmbed
 * Create an embed containing information about the teams playing
 * Lists:
 * - Odds
 * - Top wager (highest bet amount)
 * - Total wagers (total amount of money bet)
 * - Favored team
 * @returns {object} - Returns the compiled embed object
 */

export async function gameEmbed(hometeam, awayteam) {
    console.log(
        `Creating game embed information for: (away) ${awayteam} vs (home) ${hometeam}  `,
    )
    var hTeam = await resolveTeam(hometeam)
    var aTeam = await resolveTeam(awayteam)

    // setup objs to query the DB with
    var hTeamQuery = new validateData({
        tables: `${LIVEBETS}`,
        columns: `amount`,
        where: `teamid`,
        values: hTeam,
    })
    var aTeamQuery = new validateData({
        tables: `${LIVEBETS}`,
        columns: `amount`,
        where: `teamid`,
        values: aTeam,
    })
    var hTBetTotal = (await hTeamQuery.sumAll())?.sum ?? 0
    var aTBetTotal = (await aTeamQuery.sumAll())?.sum ?? 0
    var hTBetCount = (await hTeamQuery.count())?.count ?? 0
    var aTBetCount = (await aTeamQuery.count())?.count ?? 0
    var hTeamHigh = (await hTeamQuery.topWager())?.max ?? 0
    var aTeamHigh = (await aTeamQuery.topWager())?.max ?? 0
    var hOdds = (await resolveMatchup(hTeam, `odds`))
        ? await resolveMatchup(hTeam, `odds`)
        : `N/A`
    var aOdds = (await resolveMatchup(aTeam, `odds`))
        ? await resolveMatchup(aTeam, `odds`)
        : `N/A`
    let favoredTeam = Number(hOdds) < Number(aOdds) ? hTeam : aTeam // If the home team has higher odds, they are favored, otherwise the away team is favored
    let gifLink
    if (favoredTeam === hTeam) {
        gifLink = await fetchGif(hTeam)
    } else if (favoredTeam === aTeam) {
        gifLink = await fetchGif(aTeam)
    }
    var color = await resolveTeamColor(favoredTeam)
    // # collect team emoji
    var teamEmoji = (await findEmoji(favoredTeam)) || ''
    // collect server/guild icon url
    var guildIcon = SapDiscClient.guilds.cache
        .get(`${process.env.server_ID}`)
        .iconURL()
    var embObj = new MessageEmbed()
        .setTitle(`${awayteam} @ ${hometeam}`)
        .setDescription(
            `
**The ${teamEmoji} ${favoredTeam} are favored to win this game!**

*Type \`/about\` in the <#${process.env.bettingChan}> channel for information about Pluto*`,
        )
        .setFooter(``)
        .setColor(`${color}`)
        .setThumbnail(`${guildIcon}`)
        .setImage(`${gifLink}`)
    return embObj
}
