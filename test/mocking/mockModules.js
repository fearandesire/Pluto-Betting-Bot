import GameSchema from './FakerMockings.js'

/**
 * Generate an array of game objects.
 *
 * @param {number} numOfGames - The number of games to generate.
 * @param {Object} args - The arguments for generating the game.
 * @property {boolean} args.startInPast - Whether the game is in the past.
 * @property {boolean} args.completed - Whether the game is completed.
 * @property {string} args.api - API Selection
 * @return {Array} An array of game objects.
 */
export default function createMockGames(numOfGames, args) {
	const games = []
	for (let i = 0; i < numOfGames; i += 1) {
		if (args.api === `ESPN`) {
			games.push(
				GameSchema.generateGameESPN({
					startInPast: args.startInPast,
					completed: args.completed,
				}),
			)
		} else {
			games.push(
				GameSchema.generateGame({
					startInPast: args.startInPast,
					completed: args.completed,
				}),
			)
		}
	}
	return games
}
