import { MessageEmbed } from 'discord.js'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { validateData } from './../validation/validateData.js'

/**

 * @module gameEmbed
 * Create an embed containing information about the teams playing
 * List:
 * - Odds
 * - Top wager (highest bet amount)
 * - Total wagers (total amount of money bet)
 */

export async function gameEmbed(hometeam, awayteam) {
    var hTeam = await resolveTeam(hometeam)
    var aTeam = await resolveTeam(awayteam)
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
    var hOdds = await resolveMatchup(hTeam, `odds`)
    var aOdds = await resolveMatchup(aTeam, `odds`)
    let favoredTeam = Number(hOdds) < Number(aOdds) ? hTeam : aTeam // If the home team has higher odds, they are favored, otherwise the away team is favored
    var embObj = new MessageEmbed()
        .setTitle(`${awayteam} @ ${hometeam}`)
        .setDescription(
            `
        **${hometeam}**
        __Odds:__ ** \`${hOdds}\`** *| ${
                favoredTeam === hTeam ? `Favored` : `Underdogs`
            }*
        __Top Wager:__ ** \`${hTeamHigh}\`**
        __Total Wagered:__ ** \`${hTBetTotal}\`**

        **${awayteam}**
        __Odds:__ ** \`${aOdds}\`** *| ${
                favoredTeam === aTeam ? `Favored` : `Underdogs`
            }*
        __Top Wager:__ **\`${aTeamHigh}\`**
        __Total Wagered:__ ** \`${aTBetTotal}\`**
        `,
        )
        .setFooter(
            `Total # of bets: ${parseInt(
                hTBetCount + aTBetCount,
            )} | Bets on ${hometeam}: ${hTBetCount} | Bets on ${awayteam}: ${aTBetCount}`,
        )
        .setColor(`#0000fd`)
        .setThumbnail(`${process.env.sportLogo}`)
    return embObj
}
