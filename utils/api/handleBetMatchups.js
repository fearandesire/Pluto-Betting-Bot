/* eslint-disable no-continue */
import fetch from 'node-fetch'
import { Log, _ } from '#config'
import {
	apiReqLog,
	checkCompletedLog,
} from '#winstonLogger'
import { SCORE } from '#env'
import { checkBetQueue } from '../db/matchupOps/progress/checkBetQueue.js'
import { closeLostBets } from '../db/betOps/closeBets/closeLostBets.js'
import { closeWonBets } from '../db/betOps/closeBets/closeWonBets.js'
import dmMe from '../bot_res/dmMe.js'
import { idApiExisting } from '../db/validation/idApiExisting.js'
import { setProgress } from '../db/matchupOps/progress/setProgress.js'
import { determineWinner } from '../bot_res/betOps/determineWinner.js'
import { MatchupManager } from '#MatchupManager'

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
	const fileName = `[handleBetMatchups.js]`
	await checkCompletedLog.info(`Init Check Completed`, {
		status: `Initilization check for completed games`,
	})
	let response
	let apiJSON
	try {
		response = await fetch(url, options)
		apiJSON = await response.json()
	} catch (error) {
		await checkCompletedLog.error(`API Call Error`, {
			errorMsg: error,
		})
		return
	}
	const compResults = apiJSON
	await apiReqLog.info(`API Connection Info`, {
		status: `Connection successful`,
	})
	const skippedGames = []

	// eslint-disable-next-line no-unused-vars
	for await (const [key, value] of Object.entries(
		compResults,
	)) {
		const idApi = value.id
		// # check for API ID in the DB
		if (
			value.completed === true &&
			!_.isEmpty(await idApiExisting(idApi))
		) {
			// # Check if we are in the middle of processing bets
			const betQueueFlag = await checkBetQueue(
				value.home_team,
				value.away_team,
			)
			if (betQueueFlag === 'empty') {
				await Log.Red(
					`Unable to find matchup in database: ${value.home_team} vs ${value.away_team}`,
				)
				continue
			} else if (betQueueFlag === false) {
				const detWin = await determineWinner(value)
				const {
					winner,
					homeOrAwayWon,
					losingTeam,
					losingTeamHomeOrAway,
				} = detWin

				// & Declare the matchup as being processed to prevent overlapping the process of closing bets
				await setProgress(
					value.home_team,
					value.away_team,
				)

				// # Close the bets for the winners of the matchup
				await closeWonBets(
					winner,
					homeOrAwayWon,
					losingTeam,
				).catch((err) => {
					checkCompletedLog.error(`${fileName}`, {
						error: `Error closing won bets for ${winner} || ${err}`,
					})
				})
				// # Close the bets for the losers of the matchup
				await closeLostBets(
					losingTeam,
					losingTeamHomeOrAway,
					winner,
				).catch((err) => {
					checkCompletedLog.error(`Error`, {
						errorMsg: `Error closing lost bets for ${losingTeam} || ${err}`,
						hometeam: value.home_team,
						awayteam: value.away_team,
						apiId: idApi,
					})
				})
				await dmMe(
					`Closed Bets for ${value.home_team} vs ${value.away_team}`,
				)
				await MatchupManager.rmvMatchupOdds(
					value.home_team,
					value.away_team,
				)
			} else {
				await checkCompletedLog.info({
					hometeam: value.home_team,
					awayteam: value.away_team,
					apiId: idApi,
					status: `Matchup already being processed`,
					skipped: true,
				})
				await Log.Yellow(
					`Bets for Matchup: ${value.home_team} vs. ${value.away_team} are already being closed. This game will not be queued to be processed.`,
				)
				continue
			}
		} else {
			await skippedGames.push(
				`${value.home_team} vs. ${value.away_team}`,
			)
			continue
		}
	}
	await checkCompletedLog.info(`Games Skipped`, {
		status: `Skipped games:\n${skippedGames.join(
			`\n`,
		)}\n`,
	})
	await Log.Green(`{
        "stack": 'checkCompleted',
        "status": 'Completed',
    }`)
}
