import _ from 'lodash'

export default class StringUtils {
	getShortName(name: string): string {
		if (name.includes(' ')) {
			return _.last(_.split(name, ' ')) || name
		}
		return name
	}

	/**
	 * Extract the base sport from the sport key string
	 *
	 * @example 'americanfootball_nfl' -> 'nfl'
	 * @example 'basketball_nba_preseason' -> 'nba'
	 * @param sport - The sport key string to transform
	 */
	static sportKeyTransform(sport: string): string {
		const lowercaseSport = sport.toLowerCase()
		const sportMap: Record<string, string> = {
			nba: 'nba',
			nfl: 'nfl',
		}
		return (
			Object.keys(sportMap).find((key) => lowercaseSport.includes(key)) ||
			sport
		)
	}

	static standardizeString(input: string): string {
		return input
			.toLowerCase()
			.replace(/\s+/g, ' ')
			.trim()
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
	}

	/**
	 * Transform a string to title case, capitalizing the first letter of each word
	 *
	 * @example 'LOG CHANNEL' -> 'Log Channel'
	 * @param input - The string to transform
	 */
	static toTitleCase(input: string): string {
		return input
			.toLowerCase()
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
	}

	static transform
}
