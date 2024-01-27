import { faker } from '@faker-js/faker'
import { formatISO } from 'date-fns'

const NFLTEAMS = [
	'Bills',
	'Dolphins',
	'Patriots',
	'Texans',
	'Titans',
	'Colts',
	'Jaguars',
	'Ravens',
	'Broncos',
	'Chiefs',
	'Chargers',
	'49ers',
	'Packers',
	'Dolphins',
	'Patriots',
	'Texans',
	'Titans',
	'Colts',
	'Jaguars',
	'Ravens',
	'Broncos',
	'Chiefs',
	'Chargers',
	'49ers',
	'Packers',
]

export default class GameSchema {
	static generateGame(args) {
		const { startInPast, completed } = args
		let start = formatISO(faker.date.future())
		if (startInPast === true) {
			start = formatISO(faker.date.recent())
		}
		const home_team =
			faker.helpers.arrayElement(NFLTEAMS)
		const away_team =
			faker.helpers.arrayElement(NFLTEAMS)
		const game = {
			id: faker.string.uuid(),
			sport_key: 'basketball_nba',
			sport_title: 'NBA',
			commence_time: start,
			completed,
			home_team,
			away_team,
			scores: [
				{
					name: home_team,
					// Random score
					score: faker.datatype.number({
						min: 0,
						max: 100,
					}),
				},
				{
					name: away_team,
					score: faker.datatype.number({
						min: 0,
						max: 100,
					}),
				},
			],
		}
		return game
	}

	/**
	 * Generates a game object with random data.
	 *
	 * @param {Object} args - The arguments for generating the game.
	 * @property {boolean} args.startInPast - Whether the game is in the past.
	 * @property {boolean} args.completed - Whether the game is completed.
	 * @return {Object} The generated game object.
	 */

	static generateGameESPN(args) {
		const { startInPast, completed } = args
		let start = formatISO(faker.date.future())
		if (startInPast === true) {
			start = formatISO(faker.date.past())
		}
		const game = {
			id: faker.string.uuid(),
			homeTeam: faker.helpers.arrayElement(NFLTEAMS),
			awayTeam: faker.helpers.arrayElement(NFLTEAMS),
			start,
			completed,
		}
		return game
	}
}
