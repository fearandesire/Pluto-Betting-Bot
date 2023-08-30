import { MessageEmbed } from 'discord.js'
import teamResolver from 'resolve-team'
import debug from 'debug'
import { SapDiscClient } from '#main'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import {
	resolveTeam,
	resolveTeamColor,
} from '#cmdUtil/resolveTeam'
import { LIVEBETS } from '#config'

import { validateData } from '../validation/validateData.js'
import { findEmoji } from '../../bot_res/findEmoji.js'
import { SPORT } from '#env'

export async function gameEmbedPlain(homeTeam, awayTeam) {
	const hTeamObj = await teamResolver(SPORT, homeTeam, {
		full: true,
	})

	const mainColor = hTeamObj.colors[0]
	const color = mainColor

	const guildIcon = SapDiscClient.guilds.cache
		.get(`${process.env.server_ID}`)
		.iconURL()

	const embObj = new MessageEmbed()
		.setTitle(`${awayTeam} @ ${homeTeam}`)
		.setColor(`${color}`)
		.setDescription(
			`Preseason Game - Good luck to both teams!`,
		)
		.setFooter({
			text: `Pluto | Created by FENIX#7559`,
		})
		.setThumbnail(`${guildIcon}`)
	return embObj
}

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

export async function gameEmbedOdds(hometeam, awayteam) {
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
	const favoredTeam =
		Number(hOdds) < Number(aOdds) ? hTeam : aTeam // If the home team has higher odds, they are favored, otherwise the away team is favored
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

*Type \`/help\` in the <#${process.env.bettingChan}> channel to place bets with Pluto*`,
		)
		.setFooter({
			text: `Pluto | Created by FENIX#7559`,
		})
		.setColor(`${color}`)
		.setThumbnail(`${guildIcon}`)
	return embObj
}
