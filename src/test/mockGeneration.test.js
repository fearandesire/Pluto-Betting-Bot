import test from 'ava'
import createMockGames from './mocking/mockModules.js'

test(`Generates mock games`, async (t) => {
	const mockGames = await createMockGames(4, {
		startInPast: true,
		completed: false,
	})
	t.is(mockGames.length, 4)
})
