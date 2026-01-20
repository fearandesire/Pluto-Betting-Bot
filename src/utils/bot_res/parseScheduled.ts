import { helpfooter } from '@pluto-config'
import { format } from 'date-fns'
import { EmbedBuilder } from 'discord.js'
import _ from 'lodash'
import embedColors from '../../lib/colorsConfig.js'
import { logger } from '../logging/WinstonLogger.js'
import type {
	IMatchupsGrouped,
	IOddsField,
} from '../matches/matchups.interface.js'

/**
 * Parses data of games to be displayed in a schedule.
 * Intended for display within an embed on Discord.
 * @param {Array} scheduledArr - Array of games.
 * @param {Object} options - Additional options for formatting.
 * @param {boolean} options.includeOdds - Whether to include odds information in the output.
 * @param {string} options.thumbnail - URL of the thumbnail image for the embed.
 * @param {string} options.footer - Footer text for the embed.
 * @param {string} options.guildId - Guild ID for server-specific customizations.
 * @param {string} options.tzone0 - Time Zone of the user invoking request.
 * @returns {Promise<EmbedBuilder>} - Discord Embed with the games formatted and scheduled.
 */
export default async function parseScheduledGames(
	scheduledArr: IOddsField[],
	options: {
		includeOdds: boolean
		thumbnail: string
		footer: { text: string; iconURL?: string }
		guildId?: string
		tzone0?: string
	},
): Promise<EmbedBuilder> {
	const { includeOdds, thumbnail, guildId, tzone0 } = options
	//const { includeOdds, thumbnail, guildId } = options

	// Set initial title and color based on whether odds are included
	const title = includeOdds ? 'Odds 🎲' : 'Scheduled Games'
	const embColor = includeOdds
		? embedColors.PlutoBlue
		: embedColors.PlutoYellow

	if (_.isEmpty(scheduledArr)) {
		logger.debug('parseScheduledGames: received empty array', {
			guildId,
			includeOdds,
		})
		const description = includeOdds
			? 'There are no odds currently stored right now.'
			: 'No games are scheduled for the day.'
		return new EmbedBuilder()
			.setTitle(title)
			.setColor(embedColors.PlutoRed)
			.setDescription(description)
			.setFooter({ text: await helpfooter('core') })
			.setThumbnail(thumbnail)
	}

	// Group and sort the games by actual date
	const groupedGames: IMatchupsGrouped = {}
	for (const match of scheduledArr) {
		const date = match.dates.mdy
		if (!groupedGames[date]) {
			groupedGames[date] = []
		}
		groupedGames[date].push(match)
	}

	const sortedDates = Object.keys(groupedGames).sort(
		(a, b) => new Date(a).getTime() - new Date(b).getTime(),
	)

	const matchStrFn = await createMatchStr()
	let cnt = 1

	const getTimeZoneAbbreviation = (tz: string) => {
		try {
			return (
				new Intl.DateTimeFormat('en-US', {
					timeZone: tz,
					timeZoneName: 'short',
				})
					.formatToParts(new Date())
					.find((part) => part.type === 'timeZoneName')?.value || tz
			)
		} catch (error) {
			logger.debug(
				'getTimeZoneAbbreviation: error getting abbreviation',
				{
					tz,
					error,
				},
			)
			return tz
		}
	}

	const tzAbbr = tzone0 ? getTimeZoneAbbreviation(tzone0) : ''

	const fields = await Promise.all(
		sortedDates.map(async (date) => {
			try {
				const gamesList = await Promise.all(
					groupedGames[date].map(matchStrFn),
				)
				cnt--
				return {
					name:
						format(new Date(date), 'PP') +
						(cnt ? '' : tzAbbr ? ` (${tzAbbr})` : ''),
					//name: format(new Date(date), 'PP'), // Format date as 'MM/DD/YYYY'
					value: gamesList.join('\n'),
				}
			} catch (error) {
				logger.debug('parseScheduledGames: error processing date', {
					guildId,
					date,
					gameCount: groupedGames[date]?.length ?? 0,
					error,
				})
				throw error
			}
		}),
	)

	const DISABLE_DESCRIPTION_GUILD_ID = '498070362962264067'
	const shouldShowDescription = guildId !== DISABLE_DESCRIPTION_GUILD_ID

	const description = shouldShowDescription
		? 'Use /bet to place bets on any of these matches\nFor teams with multiple games this week, specify your desired match using the `match` field.'
		: undefined

	// Construct and return the embed
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor(embColor)
		.setFooter({ text: await helpfooter('core') })
		.setThumbnail(thumbnail)
		.addFields(fields)

	if (description) {
		embed.setDescription(description)
	}

	return embed
}

/**
 * Creates a formatted string representation of a match.
 * @returns {string} - Formatted string representing the match.
 */
async function createMatchStr(): Promise<
	(game: IOddsField) => Promise<string>
> {
	return async (game: IOddsField): Promise<string> => {
		const { teams } = game
		const aTeam = shortNameParse(teams.away_team.name)
		const hTeam = shortNameParse(teams.home_team.name)

		// Parse odds, considering the '+' and '-' signs
		const parseOdds = (odds: string): number => {
			if (odds.startsWith('+')) {
				return Number.parseFloat(odds.substring(1))
			}
			return Number.parseFloat(odds)
		}

		const awayOdds = parseOdds(teams.away_team.odds)
		const homeOdds = parseOdds(teams.home_team.odds)

		const isAwayTeamFavored = awayOdds < homeOdds

		const awayTeamStr = isAwayTeamFavored
			? `${aTeam} **\`(${teams.away_team.odds})\`**`
			: `${aTeam} \`(${teams.away_team.odds})\``

		const homeTeamStr = isAwayTeamFavored
			? `${hTeam} \`(${teams.home_team.odds})\``
			: `${hTeam} **\`(${teams.home_team.odds})\`**`

		return `${game.dates.legible} - ${awayTeamStr} @ ${homeTeamStr}`
		//return `${awayTeamStr} @ ${homeTeamStr}`
	}
}

/**
 * Parses the short name from a full team name.
 * @param {string} name - Full team name.
 * @returns {string} - Short name of the team.
 */
function shortNameParse(name: string): string {
	const nameParts = name.split(' ')
	return nameParts.length > 0 ? nameParts[nameParts.length - 1] : ''
}
