import { MessageEmbed } from 'discord.js'
import { SapDiscClient } from '#main'
import { findEmoji } from '../../bot_res/findEmoji.js'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { validateData } from './../validation/validateData.js'
import { LIVEBETS } from '#config'
import { resolveTeamColor } from '../../cmd_res/resolveTeam.js'
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
    let giphy
    let gif
    // # Obj with all nba teams to match their short name with their full name
    const nbaTeams = {
        Hawks: 'Atlanta Hawks',
        Celtics: 'Boston Celtics',
        Nets: 'Brooklyn Nets',
        Hornets: 'Charlotte Hornets',
        Bulls: 'Chicago Bulls',
        Cavaliers: 'Cleveland Cavaliers',
        Dallas: 'Dallas Mavericks',
        Nuggets: 'Denver Nuggets',
        Pistons: 'Detroit Pistons',
        Warriors: 'Golden State Warriors',
        Rockets: 'Houston Rockets',
        Pacers: 'Indiana Pacers',
        Wizards: 'Washington Wizards',
        Clippers: 'Los Angeles Clippers',
        Lakers: 'Los Angeles Lakers',
        Grizzlies: 'Memphis Grizzlies',
        Heat: 'Miami Heat',
        Bucks: 'Milwaukee Bucks',
        Magic: 'Orlando Magic',
        Knicks: 'New York Knicks',
        Thunder: 'Oklahoma City Thunder',
        '76ers': 'Philadelphia 76ers',
        Suns: 'Phoenix Suns',
        'Trail Blazers': 'Portland Trail Blazers',
        Kings: 'Sacramento Kings',
        Spurs: 'San Antonio Spurs',
        Raptors: 'Toronto Raptors',
        Jazz: 'Utah Jazz',
        Pelicans: 'New Orleans Pelicans',
        Timberwolves: 'Minnesota Timberwolves',
    }

    if (favoredTeam === hTeam) {
        // # Find team full name in property of nba teams.
        const teamName = nbaTeams[hTeam]
        const randomTerms = [
            `${teamName} hype`,
            `${teamName}`,
            `${teamName} scoring`,
            `${teamName} dunk`,
            `${teamName} block`,
            `${teamName} assist`,
        ]
        const selectRandomTerm =
            randomTerms[Math.floor(Math.random() * randomTerms.length)]
        // # Query Giphy API with team name + 'hype' and return one of the 5 gifs direct image link.
        const url = `https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHYAPIKEY}&q=${selectRandomTerm}&limit=25&offset=0&rating=pg-13&lang=en`
        giphy = await fetch(url).then((res) => res.json())
        // # Select 1 random gif from the 5 returned
        gif = giphy.data[Math.floor(Math.random() * giphy.data.length)]
        // # Return the gif's direct image link
        gifLink = gif.images.original.url
    } else if (favoredTeam === aTeam) {
        // # Find team full name in property of nba teams.
        const teamName = nbaTeams[aTeam]
        const randomTerms = [
            `${teamName} hype`,
            `${teamName}`,
            `${teamName} scoring`,
            `${teamName} dunk`,
            `${teamName} block`,
            `${teamName} assist`,
        ]
        const selectRandomTerm =
            randomTerms[Math.floor(Math.random() * randomTerms.length)]
        const url = `https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHYAPIKEY}&q=${selectRandomTerm}&limit=5&offset=0&rating=pg-13&lang=en`
        giphy = await fetch(url).then((res) => res.json())
        gif = giphy.data[Math.floor(Math.random() * giphy.data.length)]
        gifLink = gif.images.original.url

        var totalBetCount = parseInt(hTBetCount) + parseInt(aTBetCount)
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
