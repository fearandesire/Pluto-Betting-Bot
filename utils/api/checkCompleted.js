import { Log, NFL_SCORE, container } from '#config'
import { checkCompletedLog, completedDebug } from '#winstonLogger'

import { checkProgress } from '../db/matchupOps/progress/checkProgress.js'
import fetch from 'node-fetch'
import flatcache from 'flat-cache'
import { getShortName } from '../bot_res/getShortName.js'
import { initCloseMatchups } from '#utilMatchups/initCloseMatchups'
import { locateChannel } from '../db/gameSchedule/locateChannel.js'
import { locateMatchup } from '../db/matchupOps/locateMatchup.js'
import { queueDeleteChannel } from '../db/gameSchedule/queueDeleteChannel.js'
import { resolveToday } from '#dateUtil/resolveToday'
import { setProgress } from '../db/matchupOps/progress/setProgress.js'
import stringifyObject from 'stringify-object'

const url = NFL_SCORE
const options = {
	method: 'GET',
	headers: {
		'X-RapidAPI-Host': 'api.the-odds-api.com',
		// eslint-disable-next-line no-undef
		'X-RapidAPI-Key': process.env.odds_API_XKEY,
	},
}
/**
 * @module checkCompleted
 *
 * Calls the odds-api and accesses current score information.
 * Finished games have the `completed` property set to true.
 * When evaluating a matchup, we:
 * 1. Fetch the matchup information from the database to retrieve the ID matching both teams
 * 2. Evaluate the matchup and compare scores in the API to determine the winner
 * 3. Once the winner is determined, the information is sent to {@link initCloseMatchups} to close the bets for the matchup
 */

export async function checkCompleted(compGameMonitor) {
	let inProgressCache = await flatcache.create(
		`inProgress.json`,
		'./cache/closingMatches',
	)
	container.processQueue = 0
	await checkCompletedLog.info(`Initilization API Call for completed games`)
	await fetch(url, options)
		.then((res) => res.json())
		.then(async (json) => {
			await checkCompletedLog.info(`API Connection successful`)
			var apiCompletedResult = json
			container.apiCompResult = apiCompletedResult
		})
	var compResults = container.apiCompResult
	var todayFull = await new resolveToday().todayFullSlashes
	await checkCompletedLog.info(`API Connection Information:`)
	await checkCompletedLog.info(stringifyObject(compResults))
	let skippedGames = []
	for await (let [key, value] of Object.entries(compResults)) {
		if (value.completed === true) {
			await checkCompletedLog.info(
				`Completed Game Found in API: ${value.home_team} vs ${value.away_team}`,
			)
			await Log.Green(
				`Step 1: - Completed Game Found || ${value.home_team} vs ${value.away_team}`,
			)
			//# Check if we are in the middle of processing bets
			var checkProg = await checkProgress(value.home_team, value.away_team)
			await Log.Blue(`Step 1.5: - Check Progress: ${checkProg}`)
			if (checkProg == false) {
				//#retrieve matchId with the team's found
				var hTeam = `${value.home_team}`
				var aTeam = `${value.away_team}`
				try {
					var dbMatchId = await locateMatchup(hTeam, aTeam)
					if (!dbMatchId || dbMatchId == false || dbMatchId == undefined) {
						await checkCompletedLog.error(
							`Unable to find a matchup matchup / ID for ${value.home_team} vs. ${value.away_team}`,
						)
						await Log.Red(
							`Step 2: Unable to find a matchup matchup / ID for ${value.home_team} vs. ${value.away_team}`,
						)
						continue
					}
				} catch (err) {
					continue
				}
				await Log.Green(`Step 2: Match ID Found || ${dbMatchId}`)
				//# Queue game channel to be closed in 30 minutes
				var gameChan
				var hTeamShort = await getShortName(value.home_team)
				var aTeamShort = await getShortName(value.away_team)
				gameChan = `${hTeamShort}-vs-${aTeamShort}`
				try {
					gameChan = await locateChannel(gameChan)
					if (gameChan) {
						await queueDeleteChannel(gameChan)
						await Log.Green(
							`Step 3: - Game Channel Queued for Deletion || ${gameChan}`,
						)
					}
				} catch (err) {
					await checkCompletedLog.error(
						`Error occured during locate / delete game channel for ${value.home_team} vs. ${value.away_team}`,
					)
				}

				dbMatchId = Number(dbMatchId)
				await checkCompletedLog.info(
					`MatchId Found in Database: ${dbMatchId} - ${value.home_team} vs ${value.away_team}`,
				)

				//# determine which prop is the home team's score and away team's score by matching the team name
				let hScoreProp
				let awScoreProp
				if (value.scores[0].name === value.home_team) {
					hScoreProp = value.scores[0]
					awScoreProp = value.scores[1]
				} else if (value.scores[0].name === value.away_team) {
					hScoreProp = value.scores[1]
					awScoreProp = value.scores[0]
				}

				//# determine winner based on the scores

				var homeScore = hScoreProp.score
				var awayScore = awScoreProp.score
				var winner = ''
				if (Number(homeScore) > Number(awayScore)) {
					winner = value.home_team
					await checkCompletedLog.info(
						`Winner: Home Team: ${winner} - ${homeScore}`,
					)
				} else if (Number(homeScore) < Number(awayScore)) {
					winner = value.away_team
					await checkCompletedLog.info(
						`Winner: Away Team: ${winner} - ${awayScore}`,
					)
				}
				await Log.Green(`Step 4: Winner Determined || ${winner}`)
				//& Declare the matchup as being processed to prevent overlapping the process of closing bets
				await setProgress(value.home_team, value.away_team)
				await Log.Green(
					`Step 5: Progress Set to true || ${value.home_team} vs ${value.away_team}`,
				)
				var message = null
				//& Start closing bets for this matchup
				completedDebug.info({
					message: `Match ID: ${dbMatchId}\nHome Team: ${
						value.home_team
					}\nAway Team: ${
						value.away_team
					}\nHome Score: ${homeScore}\nAway Score: ${awayScore}\nWinner: ${winner}\nIn Progress Status: ${inProgressCache.getKey(
						`${value.home_team}-${todayFull}`,
					)}\nSending Matchup to be closed.`,
				})
				await checkCompletedLog.info(`Sent matchup ${dbMatchId} to be closed`)
				container.processQueue++
				await initCloseMatchups(message, dbMatchId, winner)
				await Log.Green(`Step 6: Matchup Closed || ${dbMatchId}`)
			} else {
				await checkCompletedLog.info(
					`Bets for Matchup: ${value.home_team} vs. ${value.away_team} are already being closed. This game will not be queued to be processed.`,
				)
				await Log.Yellow(
					`Bets for Matchup: ${value.home_team} vs. ${value.away_team} are already being closed. This game will not be queued to be processed.`,
				)
				continue
			}
		} else {
			await skippedGames.push(`${value.home_team} vs. ${value.away_team}`)
			continue
		}
	}
	await checkCompletedLog.info(`\nSkipped games:\n${skippedGames.join(`\n`)}\n`)
	await compGameMonitor.ping({
		state: 'complete',
		message: `Completed Finished Game Checks | Sent ${container.processQueue} Games to be closed`,
	})
}
