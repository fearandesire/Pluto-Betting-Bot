import _ from 'lodash'
import fetch from 'node-fetch'
import flatcache from 'flat-cache'
import Promise from 'bluebird'
import { ODDS, Log, LIVEMATCHUPS } from '#config'
import { assignMatchID } from '#botUtil/AssignIDs'
import { storeMatchups } from '#utilMatchups/storeMatchups'
import { cacheAdmn, inCache } from '#cacheMngr'
import { gameDaysCache } from '../cache/gameDaysCache.js'
import { scheduleChannels } from '../db/gameSchedule/scheduleChannels.js'
import { scheduleEmbed } from '../db/gameSchedule/scheduleEmbed.js'
import generateCronJobs from './generateCronJobs.js'
import IsoManager from '#iso'
import IsoBuilder from '../time/IsoBuilder.js'
import { fetchTodaysMatches } from '#matchMngr'
import { db } from '#db';


const oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')

/**
 * Calls the API and stores the matchup odds for the week into the database & cache.
 *
 * Steps:
 * - Fetches the matchup odds data from the API endpoint specified in the configuration.
 * - Filters the games to find only those that are scheduled for today.
 * - Identifies and stores the details for each game into an object.
 * - Generates a unique ID for each game and stores the odds information and other data for the game in the object.
 * - Stores the matchup information into the cache and database.
 * - Generates and schedules the cron jobs for the game start times.
 *
 * @async
 * @function collectOdds
 */

export default async function collectOdds() {
	const apiUrl = ODDS

	// Set API headers
	const headers = {
		'X-RapidAPI-Host': 'api.the-odds-api.com',
		'X-RapidAPI-Key': process.env.odds_API_XKEY,
	}

	// Fetch data from the API
	const apiData = await fetch(apiUrl, { method: 'GET', headers }).then((res) =>
		res.json(),
	)
	// Filter out games from the past
	const todaysGames = apiData.filter((game) =>
		new IsoBuilder(game.commence_time).isPast(),
	)

	if (_.isEmpty(todaysGames)) {
		Log.Red(`No games were found for today.`)
		return false
	}

	const matchups = {} // obj to store details of each match into cache
	// ? Identify & store details for each game via the data collected
	await Promise.map(todaysGames, async (game) => {
		const idApi = game.id

		// # Prevent duplicates
		const existingMatchup = await db.oneOrNone(
			`SELECT * FROM "${LIVEMATCHUPS}" WHERE "idapi" = $1`,
			[idApi],
		)
		if (!_.isEmpty(existingMatchup)) {
			return
		}

		const homeTeam = game.home_team
		const awayTeam = game.away_team
		const homeOdds = _.find(game.bookmakers[0]?.markets[0].outcomes, {
			name: homeTeam,
		})?.price
		const awayOdds = _.find(game.bookmakers[0]?.markets[0].outcomes, {
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

		// Date & Time info to store into the database
		const isoManager = new IsoManager(game.commence_time)
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
			idApi
		}
		await storeMatchups(colmdata) // # Store in database
		await scheduleChannels(homeTeam, awayTeam, cronStartTime, legibleStart)
		await gameDaysCache(isoManager.dayName)
	})

	// Store the matchups information into the cache
	await oddsCache.setKey('matchups', matchups)
	await oddsCache.save(true)
	if (await !inCache(`matchups`)) {
		await cacheAdmn.set('matchups', matchups)
		await Log.Green(`[collectOdds] New matchup collection stored into cache`)
	}
	await scheduleEmbed()
	await generateCronJobs(await fetchTodaysMatches())
	return true
}
