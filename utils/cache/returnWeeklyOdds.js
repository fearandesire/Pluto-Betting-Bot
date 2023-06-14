import {
	LIVEMATCHUPS,
	QuickError,
	embedReply,
} from '#config'

import { db } from '#db'
import { formatOdds } from '#cmdUtil/formatOdds'
import { SapDiscClient } from '#main'
import { guildImgURL } from '../bot_res/guildPic.js'

/**
 * @module returnWeeklyOdds
 * Return the matchups & odds for the week
 */

export async function returnWeeklyOdds(
	interaction,
	interactionEph,
) {
	const oddsFields = []
	const matchupDb = await db.manyOrNone(
		`SELECT * FROM "${LIVEMATCHUPS}"`,
	)
	if (!matchupDb || Object.keys(matchupDb).length === 0) {
		QuickError(
			interaction,
			'No odds available to view.',
		)
		return
	}
	// # iterate through matchupDB with a for loop so we can access the values of each nested object
	for (const key in matchupDb) {
		const match = matchupDb[key]
		const hTeam = match.teamone
		const aTeam = match.teamtwo
		let hOdds = match.teamoneodds
		let aOdds = match.teamtwoodds
		const matchupId = match.matchid
		const startTime = match.legiblestart
		const oddsFormat = await formatOdds(hOdds, aOdds)
		hOdds = oddsFormat.homeOdds
		aOdds = oddsFormat.awayOdds
		oddsFields.push({
			name: `• ${startTime}`,
			value: `**${hTeam}**\nOdds: *${hOdds}*\n**${aTeam}**\nOdds: *${aOdds}*\n──────`,
			inline: true,
		})
	}
	// # count # of objects in oddsFields - if the # is not divisible by 3, turn the last inline field to false
	const oddsFieldCount = oddsFields.length
	if (oddsFieldCount % 3 !== 0) {
		oddsFields[oddsFieldCount - 1].inline = false
	}
	console.log(oddsFields)
	const embedObj = {
		title: `:mega: Weekly H2H Odds`,
		fields: oddsFields,
		thumbnail: `${guildImgURL(interaction.client)}`,
		color: `#00ffff`,
		footer: 'Favored teams have a - negative number | Pluto - Designed by FENIX#7559',
	}
	embedReply(interaction, embedObj, interactionEph)
}
