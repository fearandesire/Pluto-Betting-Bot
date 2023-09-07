/* eslint-disable no-useless-escape */
import { format } from 'date-fns'
import { MessageEmbed } from 'discord.js'
import {
	_,
	helpfooter,
	dayOrder,
	orderByDays,
} from '#config'

/**
 * @function parseScheduled
 * Parse currently cached scheduled games to be displayed
 * @param {Array} scheduledArr - Array of games
 * @return {MessageEmbed} - Discord Embed with the games formatted and scheduled
 */

export default async function parseScheduled(
	scheduledArr,
	options,
) {
	const { includeOdds, thumbnail, footer } =
		options || null
	let createMatchStr
	let embColor
	let title

	if (includeOdds) {
		embColor = `#e2f1fe`
		title = `:mega: H2H Odds`
		createMatchStr = (game) =>
			`${game.away_team} *(${game.away_odds})* *@* ${game.home_team} *(${game.home_odds})* | *${game.start}**`
	} else {
		title = `Scheduled Games`
		embColor = `#fff209`
		createMatchStr = (game) =>
			`${game.away_team} @ ${game.home_team} | *${game.start}*`
	}

	// Group the scheduled games by day using Lodash's `groupBy` function
	const groupedGames = _.groupBy(scheduledArr, (game) => {
		const gameDate = new Date(game.date)
		return _.startCase(
			_.lowerCase(format(gameDate, 'EEEE')),
		)
	})

	// Sort the grouped games by day using Lodash's `orderBy` function
	const sortedGroupedGames = orderByDays(
		groupedGames,
		dayOrder,
	)

	// Create the Discord Embed
	const emb = new MessageEmbed()
		.setTitle(title)
		.setColor(embColor)
		.setFooter({ text: footer || helpfooter })
		.setThumbnail(thumbnail)
	// Add fields for each day and its corresponding games
	sortedGroupedGames.forEach(([day, games]) => {
		const gamesStr = games
			.map(createMatchStr)
			.join('\n')
		emb.addField(day, gamesStr)
	})
	return emb
}
