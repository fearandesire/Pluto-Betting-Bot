/* eslint-disable no-continue */
import fetch from 'node-fetch'
import { Log, _ } from '#config'
import { SCORE } from '#env'
import { checkBetQueue } from '../db/matchupOps/progress/checkBetQueue.js'
import { closeLostBets } from '../db/betOps/closeBets/closeLostBets.js'
import { closeWonBets } from '../db/betOps/closeBets/closeWonBets.js'
import { idApiExisting } from '../db/validation/idApiExisting.js'
import { setProgress } from '../db/matchupOps/progress/setProgress.js'
import { determineWinner } from '../bot_res/betOps/determineWinner.js'
import { MatchupManager } from '#MatchupManager'
import PlutoLogger from '#PlutoLogger'

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
	} catch (error) {
		await PlutoLogger.log({
			id: 4,
			description: `Failed to fetch API Data.\nError: \`${error.message}\``,
		})
		return
	}
	const gamesCollected = apiJSON
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
				const {
					winner,
					homeOrAwayWon,
					losingTeam,
					losingTeamHomeOrAway,
				} = detWin

				// ? Declare the matchup as being processed to prevent overlapping the process of closing bets
				await setProgress(
					value.home_team,
					value.away_team,
				)

				// # Close the bets for the winners of the matchup
				await closeWonBets(
					winner,
					homeOrAwayWon,
					losingTeam,
				).catch(async (err) => {
					await PlutoLogger.log({
						id: 3,
						description: `Error occured when closing winning bets for ${winner}\nError: \`${err.message}\``,
					})
				})
				// # Close the bets for the losers of the matchup
				await closeLostBets(
					losingTeam,
					losingTeamHomeOrAway,
					winner,
				).catch(async (err) => {
					await PlutoLogger.log({
						id: 3,
						description: `Error occured when closing winning bets for ${winner}\nError: \`${err.message}\``,
					})
				})
				const betsExisting =
					await MatchupManager.outstandingBets(
						value.home_team,
					)
				if (!betsExisting) {
					await MatchupManager.rmvMatchupOdds(
						value.home_team,
						value.away_team,
					)
					await PlutoLogger.log({
						id: 3,
						description: `Processed bets for matchup ${value.home_team} vs ${value.away_team}`,
					})
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
