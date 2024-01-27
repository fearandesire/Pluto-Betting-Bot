import discord from 'discord.js'

import _ from 'lodash'
import db from '@pluto-db'
import {
	LIVEMATCHUPS,
	QuickError,
} from '@pluto-core-config'
import { guildImgURL } from '@pluto-embed-reply'
import parseScheduled from '../parseScheduled.js'
import { formatOdds } from './formatOdds.js'

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
		return
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

	for await (const match of Object.values(oddsArr)) {
		const hTeam = `${match.teamone}`
		const aTeam = `${match.teamtwo}`
		let hOdds = match.teamoneodds
		let aOdds = match.teamtwoodds

		const oddsFormat = await formatOdds(hOdds, aOdds)
		hOdds = oddsFormat.homeOdds
		aOdds = oddsFormat.awayOdds

		const parsedStart =
			match.legiblestart.split(', ')[1]
		oddsFields.push({
			dateofmatchup: match.dateofmatchup, // Use actual date
			start: parsedStart,
			teamone: aTeam,
			teamtwo: hTeam,
			teamtwoodds: hOdds,
			teamoneodds: aOdds,
			legiblestart: match.legiblestart,
		})
	}

	// Sort the oddsFields by actual date
	const sortedOddsFields = _.orderBy(
		oddsFields,
		['dateofmatchup'],
		['asc'],
	)

	const count = sortedOddsFields.length
	const options = {
		includeOdds: true,
		footer: `Odds are subject to change | ${count} games available to bet on.`,
		thumbnail,
	}

	const gamesEmbed = parseScheduled(
		sortedOddsFields,
		options,
	)
	return gamesEmbed
}
