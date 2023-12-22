/* eslint-disable no-useless-escape */
import { format } from 'date-fns'
import discord from 'discord.js'
import { _, helpfooter } from '@pluto-core-config'
import embedColors from '../../lib/colorsConfig.js'

const { EmbedBuilder } = discord
/**
 * @function parseScheduled
 * Parse currently cached scheduled games to be displayed
 * @param {Array} scheduledArr - Array of games
 * @return {EmbedBuilder} - Discord Embed with the games formatted and scheduled
 */

export default async function parseScheduled(
	scheduledArr,
	options,
) {
	const { includeOdds, thumbnail, footer } = options || {}

	let description
	const embColor = includeOdds
		? embedColors.PlutoBlue
		: embedColors.PlutoYellow
	const title = includeOdds
		? `:mega: H2H Odds`
		: `Scheduled Games`

	if (_.isEmpty(scheduledArr)) {
		description = includeOdds
			? `There are no odds currently stored right now.`
			: `No games are scheduled for the day.`

		return new EmbedBuilder()
			.setTitle(title)
			.setColor(embedColors.PlutoRed)
			.setDescription(description)
			.setFooter({ text: footer || helpfooter })
			.setThumbnail(thumbnail)
	}

	// Group and sort the games by actual date
	const groupedGames = _.groupBy(scheduledArr, 'date')
	const sortedDates = _.orderBy(
		Object.keys(groupedGames),
		[],
		['asc'],
	)

	const fields = sortedDates.map((date) => {
		const gamesList = groupedGames[date]
			.map(createMatchStr(includeOdds))
			.join('\n')

		return {
			name: format(new Date(date), 'PP'), // Format date as 'MM/DD/YYYY'
			value: `${gamesList}\n\n*${groupedGames[date].length} games*`,
		}
	})

	return new EmbedBuilder()
		.setTitle(title)
		.setColor(embColor)
		.setFooter({ text: footer || helpfooter })
		.setThumbnail(thumbnail)
		.addFields(fields)
}

function createMatchStr(includeOdds) {
	return (game) => {
		const aTeam = shortNameParse(game.away_team)
		const hTeam = shortNameParse(game.home_team)
		const oddsStr = includeOdds
			? ` *(${game.away_odds})* *@* ${hTeam} *(${game.home_odds})* | *${game.start}*`
			: ` @ ${hTeam} | *${game.start}*`

		return `${aTeam}${oddsStr}`
	}
}

function shortNameParse(name) {
	const nameParts = name.split(' ')
	if (nameParts.length > 0) {
		return nameParts[nameParts.length - 1]
	}
	return ''
}
