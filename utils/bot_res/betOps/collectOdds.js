/* eslint-disable no-await-in-loop */
/* eslint-disable guard-for-in */

import _ from 'lodash'
import fetch from 'node-fetch'
import { ODDS, LIVEMATCHUPS } from '@pluto-core-config'
import db from '@pluto-db'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import PlutoLogger from '@pluto-logger'
import IsoManager from '@pluto-iso-manager'

/**
 * Fetches the matchup odds data from the API.
 * @returns {Promise<Array>} Array of games data
 */
async function fetchGamesData(apiUrl, headers) {
	return fetch(apiUrl, { method: 'GET', headers }).then(
		(res) => res.json(),
	)
}

/**
 * Filters games that are scheduled for the current week.
 * @param {Array} gamesArr - Array of games data
 * @returns {Array} Filtered games array
 */
function filterGamesForCurrentWeek(gamesArr) {
	return gamesArr.filter((game) => {
		const isoHandler = new IsoManager(
			game.commence_time,
		)
		return isoHandler.isSameWeek
	})
}

/**
 * Checks and filters out games already present in the database.
 * @param {Array} games - Array of games data
 * @param {Object} t - Database transaction object
 * @returns {Promise<Array>} Filtered array of new games
 */
async function filterOutExistingGames(games, t) {
	const existingIds = (
		await t.manyOrNone(
			`SELECT id FROM "${LIVEMATCHUPS}"`,
		)
	).map((record) => record.id)

	return games.filter(
		(game) => !existingIds.includes(game.id),
	)
}

/**
 * Extracts odds and game info from a game object.
 * @param {Object} game - Game object
 * @returns {Object|null} Extracted game data or null if data is incomplete
 */
async function extractGameInfo(game) {
	const homeTeam = game.home_team
	const awayTeam = game.away_team
	const matchupPath =
		game.bookmakers[0]?.markets[0].outcomes

	const homeOdds = _.find(matchupPath, {
		name: homeTeam,
	})?.price
	const awayOdds = _.find(matchupPath, {
		name: awayTeam,
	})?.price

	if (!homeOdds || !awayOdds) {
		return null
	}

	const isoManager = new IsoManager(game.commence_time)

	return {
		teamOne: homeTeam,
		teamTwo: awayTeam,
		teamOneOdds: homeOdds,
		teamTwoOdds: awayOdds,
		id: game.id,
		start: game.commence_time,
		gameDate: isoManager.mdy,
		cronStartTime: isoManager.cron,
		legibleStartTime: isoManager.legible,
	}
}

/**
 * Stores the odds information and other game data in the database.
 * @param {Object} matchups - Object containing game data keyed by game ID
 * @param {Object} t - Database transaction object
 */
async function storeMatchupData(matchups, t) {
	console.log(`Matchups:\n`, matchups)
	for (const id in matchups) {
		try {
			const game = matchups[id]

			console.log(`Storing game:\n`, game)
			await MatchupManager.storeMatchups(
				matchups[id],
				t,
			)
		} catch (err) {
			console.log(err)
			throw err
		}
	}
}

/**
 * Logs the result of the data collection process.
 * @param {number} gameCount - Number of games processed
 */
async function logResult(gameCount) {
	const msg =
		gameCount > 0
			? `Collected & updated odds for ${gameCount} games.`
			: `Collected odds, but no new data was to be updated.`

	await PlutoLogger.log({
		id: 3,
		description: msg,
	})
}

/**
 * Main function to collect odds.
 */
export default async function collectOdds() {
	const apiUrl = ODDS
	const headers = {
		'X-RapidAPI-Host': 'api.the-odds-api.com',
		'X-RapidAPI-Key': process.env.odds_API_XKEY,
	}

	const gamesArr = await fetchGamesData(apiUrl, headers)
	const filteredGames =
		filterGamesForCurrentWeek(gamesArr)

	if (_.isEmpty(filteredGames)) {
		await PlutoLogger.log({
			id: 3,
			description: `No games were found to store odds.`,
		})
		return false
	}

	await db.tx('collectOdds', async (t) => {
		const newGames = await filterOutExistingGames(
			filteredGames,
			t,
		)

		if (_.isEmpty(newGames)) {
			await PlutoLogger.log({
				id: 3,
				description: `All games are already in the database.`,
			})
			return false
		}

		const matchups = {}
		for (const game of newGames) {
			const gameData = await extractGameInfo(game)
			if (gameData) {
				matchups[gameData.id] = gameData
			}
		}

		await storeMatchupData(matchups, t)
		await logResult(_.size(matchups))
	})

	return true
}
