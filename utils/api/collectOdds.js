import _ from 'lodash'
import fetch from 'node-fetch'
import Promise from 'bluebird'
import { ODDS, LIVEMATCHUPS } from '#config'
import { assignMatchID } from '#botUtil/AssignIDs'
import { db } from '#db'
import IsoManager from '#iso'
import IsoBuilder from '../time/IsoBuilder.js'
import PlutoLogger from '#PlutoLogger'
import { MatchupManager } from '#MatchupManager'

/**
 * @function collectOdds
 * Calls the API and stores the matchup odds for the week into the database & cache.
 *
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
		return isoHandler.notInPast && isoHandler.isSameWeek
	})

	if (_.isEmpty(filteredPastGames)) {
		await PlutoLogger.log({
			id: 3,
			description: `No games were found.`,
		})
		return false
	}

	const matchups = {}
	await Promise.map(filteredPastGames, async (game) => {
		const idApi = game.id

		// # Prevent duplicates by checking for the id
		const existingMatchup = await db.oneOrNone(
			`SELECT * FROM "${LIVEMATCHUPS}" WHERE "idapi" = $1`,
			[idApi],
		)
		if (!_.isEmpty(existingMatchup)) {
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
		// Generate unique ID for the game
		const gameId = await assignMatchID()

		// Store the odds information and other data for the game
		_.assign(matchups, {
			[gameId]: {
				home_team: homeTeam,
				away_team: awayTeam,
				home_teamOdds: homeOdds,
				away_teamOdds: awayOdds,
				matchupId: gameId,
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
			matchupId: gameId,
			gameDate,
			startTimeISO: game.commence_time,
			cronStartTime,
			legibleStartTime: legibleStart,
			idApi,
		}
		await MatchupManager.storeMatchups(colmdata) // # Store in database
	})
	await PlutoLogger.log({
		id: 3,
		description: `Collected & updated odds for ${_.size(
			matchups,
		)} games.`,
	})
	return true
}
