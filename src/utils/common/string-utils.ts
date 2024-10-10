import _ from 'lodash';

export default class StringUtils {
	getShortName(name: string): string {
		if (name.includes(' ')) {
			return _.last(_.split(name, ' ')) || name;
		}
		return name;
	}

	static sportKeyTransform(sport: string): string {
		const lowercaseSport = sport.toLowerCase();
		const sportMap: Record<string, string> = {
			nba: 'nba',
			nfl: 'nfl',
		};
		return (
			Object.keys(sportMap).find((key) => lowercaseSport.includes(key)) || sport
		);
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
