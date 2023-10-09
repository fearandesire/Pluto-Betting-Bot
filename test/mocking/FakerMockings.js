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
	/**
	 * Generates a game object with random data.
	 *
	 * @param {Object} args - The arguments for generating the game.
	 * @property {boolean} args.startInPast - Whether the game is in the past.
	 * @property {boolean} args.completed - Whether the game is completed.
	 * @return {Object} The generated game object.
	 */

	static generateGame(args) {
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
