import discord from 'discord.js'

import _ from 'lodash'
import { LIVEMATCHUPS, QuickError } from '#config'
import { db } from '#db'
import { guildImgURL } from '#embed'
import parseScheduled from '../parseScheduled.js'
import IsoManager from '#iso'
import { formatOdds } from './formatOdds.js'
import { findEmoji } from '../findEmoji.js'

const { EmbedBuilder } = discord
/**
 * Return all currently available odds from the database
 * @param {Interaction} interaction - The Discord Interaction Object
 */

export default async function returnOdds(interaction) {
	const matchupDb = await db.manyOrNone(
		`SELECT * FROM "${LIVEMATCHUPS}"`,
	)
	if (_.isEmpty(matchupDb)) {
		await QuickError(
			interaction,
			'No odds available to view.',
		)
	}

	const thumbnail = await guildImgURL(interaction.client)
	const compiledEmbed = await compileOdds(
		matchupDb,
		thumbnail,
	)

	await interaction.followUp({
		embeds: [new EmbedBuilder(compiledEmbed)],
	})
}

async function compileOdds(oddsArr, thumbnail) {
	const oddsFields = []
	// eslint-disable-next-line guard-for-in
	const withEmoji = async (t) => findEmoji(t)
	for await (const match of Object.values(oddsArr)) {
		const hTeam = `${match.teamone}`
		const aTeam = `${match.teamtwo}`
		let hOdds = match.teamoneodds
		let aOdds = match.teamtwoodds
		const oddsFormat = await formatOdds(hOdds, aOdds)
		hOdds = oddsFormat.homeOdds
		aOdds = oddsFormat.awayOdds
		const isoManager = new IsoManager(match.start)
		const day = isoManager.dayName
		await oddsFields.push({
			day,
			date: match.start,
			start: isoManager.timeOnly,
			away_team: aTeam,
			home_team: hTeam,
			home_odds: hOdds,
			away_odds: aOdds,
		})
	}

	const count = oddsFields.length
	// Sort the grouped games by day using Lodash's `orderBy` function
	const options = {
		includeOdds: true,
		footer: `Odds are subject to change | ${count} games available to bet on.`,
		thumbnail,
	}
	const gamesEmbed = parseScheduled(oddsFields, options)
	return gamesEmbed
}
