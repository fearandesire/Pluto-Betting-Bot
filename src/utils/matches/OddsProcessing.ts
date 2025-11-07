import type { MatchDetailDto } from '@kh-openapi';
import { helpfooter } from '@pluto-config';
import { format, isValid, parseISO } from 'date-fns';
import _ from 'lodash';
import parseScheduledGames from '../bot_res/parseScheduled.js';
import { DateManager } from '../common/DateManager.js';
import { formatOdds } from './formatOdds.js';
import type { IOddsField } from './matchups.interface.js';

export async function prepareAndFormat(matchups: MatchDetailDto[], thumbnail: string, guildId?: string) {
	const oddsFields: IOddsField[] = [];
	const dateManager = new DateManager();
	
	for await (const match of Object.values(matchups)) {
		if (match.status === 'completed') {
			continue;
		}
		const hTeam = `${match.home_team}`;
		const aTeam = `${match.away_team}`;
		const hOdds = match.home_team_odds;
		const aOdds = match.away_team_odds;
		
		// Skip matches with missing odds
		if (hOdds == null || aOdds == null) {
			continue;
		}
		
		const { homeOdds, awayOdds } = await formatOdds(hOdds, aOdds);
		
		// Parse commence_time to get date and time components
		let parsedStart = '';
		let legiblestart = '';
		let dateofmatchup = '';
		
		if (match.commence_time) {
			try {
				const matchDate = parseISO(match.commence_time);
				if (isValid(matchDate)) {
					dateofmatchup = dateManager.toMMDDYYYY(matchDate);
					legiblestart = format(matchDate, 'EEEE, h:mm a'); // e.g., "Monday, 7:00 PM"
					const commaIndex = legiblestart.indexOf(', ');
					parsedStart = commaIndex !== -1 
						? legiblestart.slice(commaIndex + 2) 
						: format(matchDate, 'h:mm a');
				}
			} catch {
				
				parsedStart = '';
				legiblestart = '';
				dateofmatchup = '';
			}
		}
		
		oddsFields.push({
			teams: {
				home_team: {
					name: hTeam,
					odds: homeOdds,
				},
				away_team: {
					name: aTeam,
					odds: awayOdds,
				},
			},
			dates: {
				mdy: dateofmatchup,
				start: parsedStart,
				legible: legiblestart,
			},
		});
	}

	// Sort the oddsFields by actual date
	const sortedOddsFields = _.orderBy(oddsFields, ['dates.mdy'], ['asc']);

	const count = sortedOddsFields.length;
	const options = {
		includeOdds: true,
		footer: {
			text: `\`${count}\` upcoming matches | ${await helpfooter()}`,
		},
		thumbnail,
		guildId,
	};

	return await parseScheduledGames(sortedOddsFields, options);
}
