/* eslint-disable no-continue */
import fetch from 'node-fetch'
import { Log, _ } from '#config'
import { SCORE, SPORT } from '#env'
import { checkBetQueue } from '../db/matchupOps/progress/checkBetQueue.js'
import { idApiExisting } from '../db/validation/idApiExisting.js'
import { setProgress } from '../db/matchupOps/progress/setProgress.js'
import { determineWinner } from '../bot_res/betOps/determineWinner.js'
import { MatchupManager } from '#MatchupManager'
import PlutoLogger from '#PlutoLogger'
import { closeBets } from '../db/betOps/closeBets/closeBets.js'
import { queueDeleteChannel } from '../db/gameSchedule/queueDeleteChannel.js'

const url = SCORE
const options = {
	method: 'GET',
	headers: {
		'X-RapidAPI-Host': 'api.the-odds-api.com',
		// eslint-disable-next-line no-undef
		'X-RapidAPI-Key': process.env.odds_API_XKEY,
	},
}

/**
 * @module handleBetMatchups
 * Calls the odds-api and accesses current score information.
 * Determines games that have been completed and processes bets placed on those matchups
 * When evaluating a matchup, we:
 * 1. Fetch the matchup information from the database to retrieve the ID matching both teams
 * 2. Evaluate the matchup and compare scores in the API to determine the winner
 * 3. Once the winner is determined, the information is sent to {@link closeWonBets} & {@link closeLostBets} to close the bets for the matchup
 */

export async function handleBetMatchups() {
	let response
	let apiJSON
	try {
		response = await fetch(url, options)
		apiJSON = await response.json()
		await console.log(`Checking odds....`)
	} catch (error) {
		await PlutoLogger.log({
			id: 4,
			description: `Failed to fetch API Data.\nError: \`${error.message}\``,
		})
		return
	}
	// const gamesCollected = apiJSON
	const gamesCollected = [
		{
			id: '33368d4979d3475b77f5e9eb49648203',
			sport_key: 'americanfootball_nfl',
			sport_title: 'NFL',
			commence_time: '2023-09-12T00:17:17Z',
			completed: true,
			home_team: 'Los Angeles Chargers',
			away_team: 'Miami Dolphins',
			scores: [
				{
					name: 'Miami Dolphins',
					score: '16',
				},
				{
					name: 'Los Angeles Chargers',
					score: '22',
				},
			],
			last_update: '2023-09-12T08:45:01Z',
		},
		{
			id: '33368d4979d3475b77f5e9eb49648203',
			sport_key: 'americanfootball_nfl',
			sport_title: 'NFL',
			commence_time: '2023-09-12T00:17:17Z',
			completed: true,
			home_team: 'Los Angeles Chargers',
			away_team: 'Miami Dolphins',
			scores: [
				{
					name: 'Miami Dolphins',
					score: '16',
				},
				{
					name: 'Los Angeles Chargers',
					score: '22',
				},
			],
			last_update: '2023-09-12T08:45:01Z',
		},
	]
	// eslint-disable-next-line no-unused-vars
	for await (const [key, value] of Object.entries(
		gamesCollected,
	)) {
		const idApi = value.id
		const game = value
		const { completed } = game
		const isCompleted = completed === true
		const gameInMatchups = await idApiExisting(idApi)
		// ? Matchup is completed & Game is found in DB
		if (isCompleted && !_.isEmpty(gameInMatchups)) {
			// # Check if we are in the middle of processing bets for this game
			const alreadyProcessing = await checkBetQueue(
				value.home_team,
				value.away_team,
			)
			if (alreadyProcessing === 'empty') {
				await Log.Red(
					`Unable to find matchup in database: ${value.home_team} vs ${value.away_team}`,
				)
				continue
			} else if (alreadyProcessing === false) {
				const detWin = await determineWinner(value)
				const { winner: winningTeam, losingTeam } =
					detWin

				// ? Declare the matchup as being processed to prevent overlapping the process of closing bets
				await setProgress(
					value.home_team,
					value.away_team,
				)
				// # Close Bets for this matchup
				await closeBets(winningTeam, losingTeam)
				// # Ensure bets are closed for the matchup. If not, don't delete the matchup from the DB.
				// # However, it will currently need to be manually supervised in this case. The match is set to `inprogress` so it won't be procssed for bets again.
				const betsExisting =
					await MatchupManager.outstandingBets(
						value.home_team,
					).catch((err) => {
						console.log(err)
						throw new Error(
							`Issue when checking for oustanding bets`,
						)
					})
				if (!betsExisting) {
					await MatchupManager.rmvMatchupOdds(
						value.home_team,
						value.away_team,
					)
					await PlutoLogger.log({
						id: 3,
						description: `Processed bets for matchup ${value.home_team} vs ${value.away_team}`,
					})
					let channelTitle
					if (SPORT === 'nba') {
						channelTitle = `${value.home_team} vs ${value.away_team}`
					} else {
						channelTitle = `${value.home_team} at ${value.away_team}`
					}
					await queueDeleteChannel(channelTitle)
				}
			} else {
				await Log.Yellow(
					`Bets for Matchup: ${value.home_team} vs. ${value.away_team} are already being closed. This game will not be queued to be processed.`,
				)
				continue
			}
		} else {
			// Skip matchups still going / not yet completed
			continue
		}
	}
}
