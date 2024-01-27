/**
 * Module to filter game channels to be scheduled
 */

import IsoManager from '@pluto-iso-manager'

/**
 * Filter/Remove games via specified criteria:
 * - Game is in the past
 * - Game is completed
 * - Game is not in the current week
 */

export async function filterGamesArr(args) {
	const { gamesArr, SPORT } = args
	const filterGames = gamesArr.filter((game) => {
		const gameInfo = `${game.teamone} vs ${game.teamtwo}\n${game.id}`
		// ? Filter via date
		let thisWeek
		const dateManager = new IsoManager(game.start)
		if (SPORT === 'nba') {
			thisWeek = dateManager.sevenDayWeek
		} else if (SPORT === 'nfl') {
			thisWeek = dateManager.nflWeek
		} else {
			throw new Error(`Invalid SPORT: ${SPORT}`)
		}

		// ? Filter completed games
		let isCompleted = false
		if (
			game?.completed === true ||
			game?.status === 'completed'
		) {
			isCompleted = true
		}

		// ? Filter old games
		const inPast = dateManager.isInPast
		if (inPast || isCompleted) {
			return false
		}
		if (!thisWeek) {
			console.log(
				`Skipped scheduling game due to it being in another week\n${gameInfo}`,
			)
			return false
		}

		return true
	})

	return filterGames
}
