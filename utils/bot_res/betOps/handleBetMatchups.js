/* eslint-disable no-continue */
import fetch from 'node-fetch'
import _ from 'lodash'
import db from '@pluto-db'
import { SCORE } from '@pluto-core-config'
import { MatchupManager } from '@pluto-matchupOps/MatchupManager.js'
import logClr from '@pluto-internal-color-logger'
import PlutoLogger from '@pluto-logger'
import { determineWinner } from './determineWinner.js'
import { queueDeleteChannel } from '../../db/gameSchedule/queueDeleteChannel.js'
import ClosingQueue from '../../db/matchupOps/ClosingQueue.js'
import { getShortName } from '../getShortName.js'
import BetProcessor from '../../db/betOps/BetProcessor.js'

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
		text: `[handleBetMatchups] Checking for completed games\nURL: ${url}`,
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
		return false
	}
	const gamesCollected = apiJSON

	// Only handle completed games
	const filteredForCompleted = await _.filter(
		gamesCollected,
		(game) => game.completed,
	)
	// Init db transaction
	await db.tx(`handleBetMatchups`, async (t) => {
		// Init class to check progress of closing games
		const closingQueue = new ClosingQueue()
		const betPromises = await Object.entries(
			filteredForCompleted,
		).map(async ([, MATCHUP]) => {
			const { id } = MATCHUP
			const { completed } = MATCHUP
			const isCompleted = completed

			if (!isCompleted) {
				return
			}

			const matchInfo = await MatchupManager.getViaId(
				id,
				t,
			)

			if (!matchInfo) {
				console.error(
					`[HandleBetMatchups]\n Matchup: ${MATCHUP.away_team} at ${MATCHUP.home_team} not found in DB\nUnable to close bets for this matchup.`,
				)
				return
			}

			const isBeingClosed =
				await closingQueue.inProgress(id, t)
			if (isBeingClosed) {
				await PlutoLogger.log({
					id: 3,
					description: `Matchup ${MATCHUP.home_team} vs ${MATCHUP.away_team} is already being closed\nSkipping this matchup for bet handling`,
				})
				return
			}

			if (MATCHUP.scores === null) {
				await PlutoLogger.log({
					id: 3,
					description: `No scores found for matchup ${MATCHUP.home_team} vs ${MATCHUP.away_team}`,
				})
				return
			}

			// ? Identify which team won
			const detWin = await determineWinner(MATCHUP)
			const { winner: winningTeam, losingTeam } =
				detWin
			// ? Save winning and losing teams in DB
			await MatchupManager.storeMatchResult(
				{
					winner: winningTeam,
					loser: losingTeam,
					id,
				},
				t,
			)

			// ? Prevent closing this matchup again if it's already been noted as being closed
			await closingQueue.setProgress(id, t)

			// ! Close Bets for this matchup
			try {
				await new BetProcessor(t).closeBets(
					winningTeam,
					losingTeam,
					matchInfo,
				)
			} catch (error) {
				await PlutoLogger.log({
					id: 4,
					description: `Failed to close bets for matchup ${MATCHUP.home_team} vs ${MATCHUP.away_team}\nError: \`${error?.message}\``,
				})
				console.error(error)
				return
			}

			// # Ensure bets are closed for the matchup. If not, don't delete the matchup from the DB.
			// # However, it will currently need to be manually supervised in this case. The match is set to `inprogress` so it won't be procssed for bets again.
			const betsExisting =
				await MatchupManager.outstandingBets(
					matchInfo.id,
					t,
				)
			if (!betsExisting) {
				await MatchupManager.rmvMatchupOdds(id, t)
				await PlutoLogger.log({
					id: 3,
					description: `Processed bets for matchup ${MATCHUP.home_team} vs ${MATCHUP.away_team}`,
				})

				// Channels are using the 'shortname' of a team - e.g Celtics vs Lakers
				const aTeamShortName = getShortName(
					MATCHUP.away_team,
				)
				const hTeamShortName = getShortName(
					MATCHUP.home_team,
				)
				const channelTitle = `${aTeamShortName.toLowerCase()} vs ${hTeamShortName.toLowerCase()}`
				// ? Account for public-facing channel difference of `vs` anad `at`; Preference for each server

				await queueDeleteChannel(channelTitle)
			} else if (betsExisting) {
				await PlutoLogger.log({
					id: 3,
					description: `Matchup ${MATCHUP.home_team} vs ${MATCHUP.away_team} has outstanding bets - skipping deletion of this matchup in the DB.`,
				})
			}
		})
		await Promise.all(betPromises)
		return true
	})
}
