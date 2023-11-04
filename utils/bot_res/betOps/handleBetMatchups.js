/* eslint-disable no-continue */
import fetch from 'node-fetch'
import Promise from 'bluebird'
import _ from 'lodash'
import { LIVEMATCHUPS, SCORE } from '#config'
import { SPORT } from '#env'
import { db } from '#db'
import { determineWinner } from './determineWinner.js'
import { MatchupManager } from '#MatchupManager'
import PlutoLogger from '#PlutoLogger'
import { closeBets } from '../../db/betOps/closeBets/closeBets.js'
import { queueDeleteChannel } from '../../db/gameSchedule/queueDeleteChannel.js'
import ClosingQueue from '../../db/matchupOps/ClosingQueue.js'
import logClr from '#colorConsole'
import { getShortName } from '../getShortName.js'

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
	await logClr({
		text: `[handleBetMatchups] Checking for completed games`,
		color: `blue`,
		status: `processing`,
	})
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

	// Only handle completed games
	const filteredForCompleted = await _.filter(
		gamesCollected,
		(game) => game.completed,
	)
	// Init db transaction
	const dbCnx = await db.tx(
		`handleBetMatchups`,
		async (t) => {
			// Init class to check progress of closing games
			const closingQueue = new ClosingQueue()
			// eslint-disable-next-line no-unused-vars
			const betPromises = await Object.entries(
				filteredForCompleted,
			).map(async ([, MATCHUP]) => {
				const { id } = MATCHUP
				const { completed } = MATCHUP
				const isCompleted = completed

				if (!isCompleted) {
					return
				}

				const matchExists =
					await MatchupManager.getViaId(id, t)

				if (!matchExists) {
					return
				}
				// ? Validation: Bets are not in the process of being closed right now for this matchup
				const isBeingClosed =
					await closingQueue.inProgress(id, t)

				if (isBeingClosed) {
					return
				}

				if (MATCHUP.scores === null) {
					await PlutoLogger.log({
						id: 3,
						description: `No scores found for matchup ${MATCHUP.home_team} vs ${MATCHUP.away_team}`,
					})
					return
				}

				// ? Matchup is validated |> Process matchup

				const detWin = await determineWinner(
					MATCHUP,
				)
				const { winner: winningTeam, losingTeam } =
					detWin

				// ? Set status of matchup closing to true
				await closingQueue.setProgress(id, t)

				const matchInfo = await getMatchInfo(id, t)

				// ! Close Bets for this matchup
				await closeBets(
					winningTeam,
					losingTeam,
					matchInfo,
					t,
				)

				// # Ensure bets are closed for the matchup. If not, don't delete the matchup from the DB.
				// # However, it will currently need to be manually supervised in this case. The match is set to `inprogress` so it won't be procssed for bets again.
				const betsExisting =
					await MatchupManager.outstandingBets(
						id,
						dbCnx,
					)
				if (!betsExisting) {
					await MatchupManager.rmvMatchupOdds(
						id,
						dbCnx,
					)
					await PlutoLogger.log({
						id: 3,
						description: `Processed bets for matchup ${MATCHUP.home_team} vs ${MATCHUP.away_team}`,
					})
					let channelTitle
					// Channels are using the 'shortname' of a team - e.g Celtics vs Lakers
					const aTeamShortName = getShortName(
						MATCHUP.away_team,
					)
					const hTeamShortName = getShortName(
						MATCHUP.home_team,
					)
					// ? Account for public-facing channel difference of `vs` anad `at`; Preference for each server
					if (SPORT === 'nba') {
						channelTitle = `${aTeamShortName.toLowerCase()} vs ${hTeamShortName.toLowerCase()}`
					} else {
						channelTitle = `${aTeamShortName.toLowerCase()} at ${hTeamShortName.toLowerCase()}`
					}
					await queueDeleteChannel(channelTitle)
				}
			})
			await Promise.all(betPromises)
		},
	)
}

/**
 * Retrieves match information for two teams.
 *
 * @param {string} teamOne - The name of team one.
 * @param {string} teamTwo - The name of team two.
 * @return {Promise<Object|null>} A Promise that resolves to the match information for the two teams,
 *         or null if no match information is found.
 */
async function getMatchInfo(id, dbCnx) {
	return dbCnx.oneOrNone(
		`SELECT * FROM "${LIVEMATCHUPS}" WHERE id = $1`,
		[id],
	)
}
