import _ from 'lodash'

export default class StringUtils {
	getShortName(name: string): string {
		if (name.includes(' ')) {
			return _.last(_.split(name, ' ')) || name
		} else {
			return name
		}
	}

	static sportKeyTransform(sport: string): string {
		// Convert americanfootball_nfl to nfl, baseball_mlb to mlb, etc.
		if (sport.includes('_')) {
			return sport.split('_')[1]
		}
		return sport
	}
}
