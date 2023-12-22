import _ from 'lodash'
import fetch from 'node-fetch'
import Promise from 'bluebird'
import { ODDS, LIVEMATCHUPS } from '@pluto-core-config'
import db from '@pluto-db'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import PlutoLogger from '@pluto-logger'
import IsoManager from '@pluto-iso-manager'

/**
 * @function collectOdds
 * Calls the API and stores the matchup odds for the week into the database & cache.
 * Steps:
 * - Fetches the matchup odds data from the API endpoint specified in the configuration.
 * - Filters the games to find only those that are scheduled for today.
 * - Identifies and stores the details for each game into an object.
 * - Generates a unique ID for each game and stores the odds information and other data for the game in the object.
 * - Stores the matchup information into the cache and database.
 * - Generates and schedules the cron jobs for the game start times.
 */

export default async function collectOdds() {
	const apiUrl = ODDS

	// Set API headers
	const headers = {
		'X-RapidAPI-Host': 'api.the-odds-api.com',
		'X-RapidAPI-Key': process.env.odds_API_XKEY,
	}

	// Fetch data from the API
	const gamesArr = await fetch(apiUrl, {
		method: 'GET',
		headers,
	}).then((res) => res.json())
	// Filter out games from the past
	const filteredPastGames = gamesArr.filter((game) => {
		const isoHandler = new IsoManager(
			game.commence_time,
		)
		return isoHandler.isSameWeek
	})

	if (_.isEmpty(filteredPastGames)) {
		await PlutoLogger.log({
			id: 3,
			description: `No games were found to store odds.`,
		})
		return false
	}
	// Create db transaction as we will have several queries
	await db.tx(`collectOdds`, async (t) => {
		// Make a single query to get an array of all `id` values in matchups table
		const matchupIds = await t.manyOrNone(
			`SELECT id FROM "${LIVEMATCHUPS}"`,
		)
		const matchups = {}
		await Promise.map(
			filteredPastGames,
			async (game) => {
				const idApi = game.id

				// # Prevent duplicates by checking for the id
				const existingMatchup =
					_.find(matchupIds, {
						id: idApi,
					}) || null
				if (existingMatchup !== null) {
					return
				}
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

				// Skip games without odds information
				if (!homeOdds || !awayOdds) {
					return
				}

				// Store the odds information and other data for the game
				_.assign(matchups, {
					[idApi]: {
						home_team: homeTeam,
						away_team: awayTeam,
						home_teamOdds: homeOdds,
						away_teamOdds: awayOdds,
						id: idApi,
						start_time: game.commence_time,
					},
				})

				// Generate date & time info
				const isoManager = new IsoManager(
					game.commence_time,
				)
				const gameDate = isoManager.mdy
				const cronStartTime = isoManager.cron

				const legibleStart = isoManager.legible
				const colmdata = {
					teamOne: homeTeam,
					teamTwo: awayTeam,
					teamOneOdds: homeOdds,
					teamTwoOdds: awayOdds,
					id: idApi,
					gameDate,
					start: game.commence_time,
					cronStartTime,
					legibleStartTime: legibleStart,
				}
				await MatchupManager.storeMatchups(
					colmdata,
					t,
				)
			},
		)

		const gameCount = _.size(matchups)
		const msg =
			gameCount > 0
				? `Collected & updated odds for ${gameCount} games.`
				: `Collected odds, but no new data was to be updated.`
		await PlutoLogger.log({
			id: 3,
			description: msg,
		})
	})
	return true
}
