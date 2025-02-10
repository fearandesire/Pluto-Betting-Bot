import { helpfooter } from '@pluto-config';
import { format } from 'date-fns';
import { EmbedBuilder } from 'discord.js';
import _ from 'lodash';
import embedColors from '../../lib/colorsConfig.js';
import type {
	IMatchupsGrouped,
	IOddsField,
} from '../matches/matchups.interface.js';

/**
 * Parses data of games to be displayed in a schedule.
 * Intended for embed in Discord platform.
 * @param {Array} scheduledArr - Array of games.
 * @param {Object} options - Additional options for formatting.
 * @param {boolean} options.includeOdds - Whether to include odds information in the output.
 * @param {string} options.thumbnail - URL of the thumbnail image for the embed.
 * @param {string} options.footer - Footer text for the embed.
 * @returns {EmbedBuilder} - Discord Embed with the games formatted and scheduled.
 */
export default async function parseScheduledGames(
	scheduledArr: IOddsField[],
	options: {
		includeOdds: boolean;
		thumbnail: string;
		footer: { text: string; iconURL?: string };
	},
) {
	const { includeOdds, thumbnail } = options;

	// Set initial title and color based on whether odds are included
	const title = includeOdds ? 'Odds 🎲' : 'Scheduled Games';
	const embColor = includeOdds
		? embedColors.PlutoBlue
		: embedColors.PlutoYellow;

	if (_.isEmpty(scheduledArr)) {
		const description = includeOdds
			? 'There are no odds currently stored right now.'
			: 'No games are scheduled for the day.';
		return new EmbedBuilder()
			.setTitle(title)
			.setColor(embedColors.PlutoRed)
			.setDescription(description)
			.setFooter({ text: await helpfooter('core') })
			.setThumbnail(thumbnail);
	}

	// Group and sort the games by actual date
	const groupedGames: IMatchupsGrouped = {};
	for (const match of scheduledArr) {
		const date = match.dates.mdy;
		if (!groupedGames[date]) {
			groupedGames[date] = [];
		}
		groupedGames[date].push(match);
	}

	const sortedDates = Object.keys(groupedGames).sort(
		(a, b) => new Date(a).getTime() - new Date(b).getTime(),
	);

	const fields = await Promise.all(
		sortedDates.map(async (date) => {
			const gamesList = await Promise.all(
				groupedGames[date].map(await createMatchStr()),
			);
			return {
				name: format(new Date(date), 'PP'), // Format date as 'MM/DD/YYYY'
				value: gamesList.join('\n'),
			};
		}),
	);

	const description =
		'Use /bet to place bets on any of these matches\nFor teams with multiple games this week, specify your desired match using the `match` field.';
	// Construct and return the embed
	return new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setColor(embColor)
		.setFooter({ text: await helpfooter('core') })
		.setThumbnail(thumbnail)
		.addFields(fields);
}

/**
 * Creates a formatted string representation of a match.
 * @param {boolean} includeOdds - Whether to include odds information.
 * @returns {string} - Formatted string representing the match.
 */
async function createMatchStr(): Promise<
	(game: IOddsField) => Promise<string>
> {
	return async (game: IOddsField): Promise<string> => {
		const { teams } = game;
		const aTeam = shortNameParse(teams.away_team.name);
		const hTeam = shortNameParse(teams.home_team.name);

		// Parse odds, considering the '+' and '-' signs
		const parseOdds = (odds: string): number => {
			if (odds.startsWith('+')) {
				return Number.parseFloat(odds.substring(1));
			}
			return Number.parseFloat(odds);
		};

		const awayOdds = parseOdds(teams.away_team.odds);
		const homeOdds = parseOdds(teams.home_team.odds);

		const isAwayTeamFavored = awayOdds < homeOdds;

		const awayTeamStr = isAwayTeamFavored
			? `${aTeam} **\`(${teams.away_team.odds})\`**`
			: `${aTeam} \`(${teams.away_team.odds})\``;

		const homeTeamStr = isAwayTeamFavored
			? `${hTeam} \`(${teams.home_team.odds})\``
			: `${hTeam} **\`(${teams.home_team.odds})\`**`;

		return `${awayTeamStr} @ ${homeTeamStr}`;
	};
}

/**
 * Parses the short name from a full team name.
 * @param {string} name - Full team name.
 * @returns {string} - Short name of the team.
 */
function shortNameParse(name: string): string {
	const nameParts = name.split(' ');
	return nameParts.length > 0 ? nameParts[nameParts.length - 1] : '';
}
