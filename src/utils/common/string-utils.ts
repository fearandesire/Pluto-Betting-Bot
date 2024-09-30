import _ from 'lodash';

export default class StringUtils {
	getShortName(name: string): string {
		if (name.includes(' ')) {
			return _.last(_.split(name, ' ')) || name;
		}
		return name;
	}

	static sportKeyTransform(sport: string): string {
		// Convert americanfootball_nfl to nfl, baseball_mlb to mlb, etc.
		if (sport.includes('_')) {
			return sport.split('_')[1];
		}
		return sport;
	}

	static standardizeString(input: string): string {
		return input
			.toLowerCase()
			.replace(/\s+/g, ' ')
			.trim()
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
}
