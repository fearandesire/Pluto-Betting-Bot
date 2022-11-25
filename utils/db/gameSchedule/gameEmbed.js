import { MessageEmbed } from 'discord.js'
import { SapDiscClient } from '#main'
import { findEmoji } from '../../bot_res/findEmoji.js'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { validateData } from './../validation/validateData.js'

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
    var hTeam = await resolveTeam(hometeam)
    var aTeam = await resolveTeam(awayteam)
    // setup objs to query the DB with
    var hTeamQuery = new validateData({
        tables: `activebets`,
        columns: `amount`,
        where: `teamid`,
        values: hTeam,
    })
    var aTeamQuery = new validateData({
        tables: `activebets`,
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
    var totalBetCount = parseInt(hTBetCount) + parseInt(aTBetCount)
    // collect server/guild icon url
    var guildIcon = SapDiscClient.guilds.cache
        .get(`${process.env.server_ID}`)
        .iconURL()
    var embObj = new MessageEmbed()
        .setTitle(`${awayteam} @ ${hometeam}`)
        .setDescription(
            `
**The ${favoredTeam} are favored to win this game!**

** ${(await findEmoji(hometeam)) || ''} ${hTeam}** 
__Odds:__ ** \`${hOdds}\`** *| ${
                favoredTeam === hTeam ? `Favored` : `Underdogs`
            }*
__Top Wager:__ ** \`${hTeamHigh}\`**
__Total Wagered:__ ** \`${hTBetTotal}\`**

** ${(await findEmoji(awayteam)) || ''} ${aTeam}**
__Odds:__ ** \`${aOdds}\`** *| ${
                favoredTeam === aTeam ? `Favored` : `Underdogs`
            }*
__Top Wager:__ **\`${aTeamHigh}\`**
__Total Wagered:__ ** \`${aTBetTotal}\`**
            
*__Bet Counts__
${hometeam}: ${hTBetCount}
${awayteam}: ${aTBetCount}
Total: ${totalBetCount}*

*Type \`/about\` in the <#${
                process.env.NBAbettingChan_ID
            }> channel for information about Pluto*`,
        )
        .setFooter(``)
        .setColor(`#68d6e6`)
        .setThumbnail(`${guildIcon}`)
    return embObj
}
