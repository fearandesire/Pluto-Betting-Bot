/* eslint-disable no-useless-escape */
import { format } from 'date-fns'
import discord from 'discord.js'
import {
	_,
	helpfooter,
	dayOrder,
	orderByDays,
} from '@pluto-core-config'
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
	const { includeOdds, thumbnail, footer } =
		options || null
	let createMatchStr
	let embColor
	let title
	let description

	if (_.isEmpty(scheduledArr)) {
		// Embed should just state no games for today
		if (includeOdds) {
			title = `:mega: H2H Odds`
			description = `There are no odds currently stored right now.`
		} else {
			title = `Scheduled Games`
			description = `No games are scheduled for the day.`
		}
		const emb = new EmbedBuilder()
			.setTitle(title)
			.setColor(embedColors.PlutoRed)
			.setDescription(description)
			.setFooter({ text: footer || helpfooter })
			.setThumbnail(thumbnail)
		return emb
	}
	if (includeOdds) {
		embColor = `${embedColors.PlutoBlue}`
		title = `:mega: H2H Odds`
		createMatchStr = (game) => {
			const aTeam = shortNameParse(game.away_team)
			const hTeam = shortNameParse(game.home_team)
			return `${aTeam} *(${game.away_odds})* *@* ${hTeam} *(${game.home_odds})* | *${game.start}*`
		}
	} else {
		title = `Scheduled Games`
		embColor = `${embedColors.PlutoYellow}`
		createMatchStr = (game) => {
			const aTeam = shortNameParse(game.away_team)
			const hTeam = shortNameParse(game.home_team)
			return `${aTeam} @ ${hTeam} | *${game.start}*`
		}
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
	const gamesCount = _.size(scheduledArr)
	const fields = []
	// Create the Discord Embed
	const emb = new EmbedBuilder()
		.setTitle(title)
		.setColor(embColor)
		.setFooter({ text: footer || helpfooter })
		.setThumbnail(thumbnail)
	// Add fields for each day and its corresponding games
	sortedGroupedGames.forEach(([day, games]) => {
		const gamesStr = games
			.map(createMatchStr)
			.join('\n')
		fields.push({
			name: day,
			value: `${gamesStr}\n\n*${gamesCount} games total*`,
		})
	})
	emb.addFields(fields)
	return emb
}

function shortNameParse(name) {
	const nameParts = name.split(' ')
	if (nameParts.length > 0) {
		return nameParts[nameParts.length - 1]
	}
	return ''
}
