import discord from 'discord.js'
import teamResolver from 'resolve-team'
import { SapDiscClient } from '#main'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'

import { SPORT } from '#env'
import { validateData } from '../validation/validateData.js'
import { findEmoji } from '../../bot_res/findEmoji.js'

const { EmbedBuilder } = discord
export async function gameEmbedPlain(homeTeam, awayTeam) {
	const hTeamObj = await teamResolver(SPORT, homeTeam, {
		full: true,
	})

	const mainColor = hTeamObj.colors[0]
	const color = mainColor

	const guildIcon = SapDiscClient.guilds.cache
		.get(`${process.env.server_ID}`)
		.iconURL()

	const embObj = new EmbedBuilder()
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

export async function gameEmbedOdds(homeTeam, awayTeam) {
	const hTeamObj = await teamResolver(SPORT, homeTeam, {
		full: true,
	})
	const aTeamObj = await teamResolver(SPORT, awayTeam, {
		full: true,
	})
	const hTeam = hTeamObj.name
	const aTeam = aTeamObj.name
	/** 
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
	* */
	const home_team_odds = await resolveMatchup(
		hTeam,
		`odds`,
	)
	const away_team_odds = await resolveMatchup(
		aTeam,
		`odds`,
	)
	const hOdds = home_team_odds || `N/A`
	const aOdds =
		away_team_odds || `N/A`
			? await resolveMatchup(aTeam, `odds`)
			: `N/A`
	const favoredTeam =
		Number(hOdds) < Number(aOdds) ? hTeam : aTeam // If the home team has higher odds, they are favored, otherwise the away team is favored
	const color =
		favoredTeam === hTeam
			? hTeamObj.colors[0]
			: aTeamObj.colors[0]
	// # collect team emoji
	const teamEmoji = (await findEmoji(favoredTeam)) || ''
	// collect server/guild icon url
	const guildIcon = SapDiscClient.guilds.cache
		.get(`${process.env.server_ID}`)
		.iconURL()
	const embObj = new EmbedBuilder()
		.setTitle(`${awayTeam} @ ${homeTeam}`)
		.setDescription(
			`
**The ${teamEmoji} ${favoredTeam} are favored to win this game!**

*Type \`/help\` in the <#${process.env.bettingChan}> channel to place bets with Pluto*`,
		)
		.setFooter({
			text: `Pluto | Created by fenixforever`,
		})
		.setColor(`${color}`)
		.setThumbnail(`${guildIcon}`)
	return embObj
}
