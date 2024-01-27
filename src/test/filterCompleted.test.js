import test from 'ava'
import _ from 'lodash'
import createMockGames from './mocking/mockModules.js'

test(`It should strictly list completed games`, async (t) => {
	const games = await createMockGames(4, {
		api: `Odds`,
		completed: true,
	})
	// Filter out games that are not completed
	const completedGames = _.filter(
		games,
		(game) => game.completed,
	)
	// Should be 4 games
	t.true(completedGames.length === 4)
})
