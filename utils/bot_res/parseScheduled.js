import { format } from 'date-fns'
import { MessageEmbed } from 'discord.js'
import { _, helpfooter } from '#config'

/**
 * @function parseScheduled
 * Parse currently cached scheduled games to be displayed
 * @param {Array} scheduledArr - Array of games
 * @return {MessageEmbed} - Discord Embed with the games formatted and scheduled
 */

export default async function parseScheduled(
	scheduledArr,
	sport,
) {
	const createMatchStr = (game) =>
		`${game.away_team} *@* ${game.home_team}`

	// Group the scheduled games by day using Lodash's `groupBy` function
	const groupedGames = _.groupBy(scheduledArr, (game) => {
		const gameDate = new Date(game.date)
		return _.startCase(
			_.lowerCase(format(gameDate, 'EEEE')),
		)
	})
	let dayOrder
	if (sport === 'nfl') {
		dayOrder = [
			'Thursday',
			'Friday',
			'Saturday',
			'Sunday',
			'Monday',
			'Tuesday',
			'Wednesday',
		]
	} else if (sport === 'nba') {
		dayOrder = [
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday',
			'Sunday',
		]
	} else {
		return false
	}
	// Sort the grouped games by day using Lodash's `orderBy` function
	const sortedGroupedGames = _.orderBy(
		Object.entries(groupedGames),
		([day]) => _.indexOf(dayOrder, day),
		['asc'],
	)

	// Create the Discord Embed
	const emb = new MessageEmbed()
		.setTitle(`Scheduled Games`)
		.setColor('#e0ff19')
		.setFooter({ text: helpfooter })

	// Add fields for each day and its corresponding games
	sortedGroupedGames.forEach(([day, games]) => {
		const gamesStr = games
			.map(createMatchStr)
			.join('\n')
		emb.addField(day, gamesStr)
	})
	return emb
}
