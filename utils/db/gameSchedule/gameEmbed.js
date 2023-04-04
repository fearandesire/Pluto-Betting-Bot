import { MessageEmbed } from 'discord.js'
import { SapDiscClient } from '#main'
import { findEmoji } from '../../bot_res/findEmoji.js'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { validateData } from '../validation/validateData.js'
import { LIVEBETS, GOOGLE_CUSTOM } from '#config'
import { resolveTeamColor } from '../../cmd_res/resolveTeam.js'
import { fetchVsImg } from '#utilBot/fetchVsImg'

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
	const hTeam = await resolveTeam(hometeam)
	const aTeam = await resolveTeam(awayteam)

	// setup objs to query the DB with
	const hTeamQuery = new validateData({
		tables: `${LIVEBETS}`,
		columns: `amount`,
		where: `teamid`,
		values: hTeam,
	})
	const aTeamQuery = new validateData({
		tables: `${LIVEBETS}`,
		columns: `amount`,
		where: `teamid`,
		values: aTeam,
	})
	const hOdds = (await resolveMatchup(hTeam, `odds`))
		? await resolveMatchup(hTeam, `odds`)
		: `N/A`
	const aOdds = (await resolveMatchup(aTeam, `odds`))
		? await resolveMatchup(aTeam, `odds`)
		: `N/A`
	const favoredTeam = Number(hOdds) < Number(aOdds) ? hTeam : aTeam // If the home team has higher odds, they are favored, otherwise the away team is favored
	const imgLink = await fetchVsImg(`${hTeam} vs ${aTeam}`, GOOGLE_CUSTOM).catch(
		(err) => console.error(err),
	)
	await console.log(`Img Link generated: ${imgLink}`)
	const color = await resolveTeamColor(favoredTeam)
	// # collect team emoji
	const teamEmoji = (await findEmoji(favoredTeam)) || ''
	// collect server/guild icon url
	const guildIcon = SapDiscClient.guilds.cache
		.get(`${process.env.server_ID}`)
		.iconURL()
	const embObj = new MessageEmbed()
		.setTitle(`${awayteam} @ ${hometeam}`)
		.setDescription(
			`
**The ${teamEmoji} ${favoredTeam} are favored to win this game!**

*Type \`/about\` in the <#${process.env.bettingChan}> channel for information about Pluto*`,
		)
		.setFooter(``)
		.setColor(`${color}`)
		.setThumbnail(`${guildIcon}`)
	if (imgLink) {
		embObj.setImage(`${imgLink}`)
	}
	return embObj
}
