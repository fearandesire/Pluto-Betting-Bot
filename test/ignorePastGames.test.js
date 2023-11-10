import test from 'ava'
import createMockGames from './mocking/mockModules.js'
import { filterGamesArr } from '../utils/db/gameSchedule/schedChanFilter.js'

test(`Prevent Game Channels in the past from being scheduled`, async (t) => {
	const gameArr = await createMockGames(4, {
		startInPast: true,
		completed: false,
	})
	const filterGames = await filterGamesArr({
		gamesArr: gameArr,
		SPORT: 'nba',
	})
	t.is(filterGames.length, 0)
})
