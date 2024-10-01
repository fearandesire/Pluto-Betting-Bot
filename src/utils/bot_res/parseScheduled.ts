import { _, helpfooter } from '@pluto-config';
import { format } from 'date-fns';
import { EmbedBuilder } from 'discord.js';
import embedColors from '../../lib/colorsConfig.js';
import { patreonFooter } from '../api/patreon/interfaces.js';
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
export default async function parseScheduled(
	scheduledArr: IOddsField[],
	options: {
		includeOdds: boolean;
		thumbnail: string;
		footer: { text: string; iconURL?: string };
	},
) {
	const { includeOdds, thumbnail } = options;

	// Set initial title and color based on whether odds are included
	const title = includeOdds ? ':mega: H2H Odds' : 'Scheduled Games';
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
			.setFooter(patreonFooter || { text: helpfooter() })
			.setThumbnail(thumbnail);
	}

	// Group and sort the games by actual date
	const groupedGames: IMatchupsGrouped = {};
	scheduledArr.forEach((match) => {
		const date = match.dates.mdy;
		if (!groupedGames[date]) {
			groupedGames[date] = [];
		}
		groupedGames[date].push(match);
	});

	const sortedDates = Object.keys(groupedGames).sort(
		(a, b) => new Date(a).getTime() - new Date(b).getTime(),
	);

	const fields = await Promise.all(
		sortedDates.map(async (date) => {
			const gamesList = await Promise.all(
				groupedGames[date].map(await createMatchStr(includeOdds)),
			);
			return {
				name: format(new Date(date), 'PP'), // Format date as 'MM/DD/YYYY'
				value: gamesList.join('\n'),
			};
		}),
	);

	// Construct and return the embed
	return new EmbedBuilder()
		.setTitle(title)
		.setColor(embColor)
		.setFooter({ text: helpfooter() })
		.setThumbnail(thumbnail)
		.addFields(fields);
}

/**
 * Creates a formatted string representation of a match.
 * @param {boolean} includeOdds - Whether to include odds information.
 * @returns {string} - Formatted string representing the match.
 */
async function createMatchStr(
	includeOdds: boolean,
): Promise<(game: IOddsField) => Promise<string>> {
	return async (game: IOddsField): Promise<string> => {
		const { teams } = game;
		const aTeam = shortNameParse(teams.away_team.name);
		const hTeam = shortNameParse(teams.home_team.name);
		// Arrow function to replace anything before the first digit. e.g `Sat, 9:00 PM` => `9:00 PM`
		// const rmDay = (timeStr) => { }
		const oddsStr = includeOdds
			? ` *(${teams.away_team.odds})* *@* ${hTeam} *(${teams.home_team.odds})* | *${game.dates.legible}*`
			: ` @ ${hTeam} | *${game.dates.legible}*`;
		return `${aTeam}${oddsStr}`;
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
