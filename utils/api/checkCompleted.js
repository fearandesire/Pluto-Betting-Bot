import { NBA_SCORE, container } from '#config'

import { checkCompletedLog } from '#winstonLogger'
import fetch from 'node-fetch'
import flatcache from 'flat-cache'
import { initCloseMatchups } from '#utilMatchups/initCloseMatchups'
import { locateMatchup } from '../db/matchupOps/locateMatchup.js'
import stringifyObject from 'stringify-object'

const url = NBA_SCORE
const options = {
    method: 'GET',
    headers: {
        'X-RapidAPI-Host': 'api.the-odds-api.com',
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
    let inProgressCache = flatcache.create(
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
    await checkCompletedLog.info(`API Connection Information:`)
    await checkCompletedLog.info(stringifyObject(compResults))
    for await (let [key, value] of Object.entries(compResults)) {
        // await _.forEach(compResults, async function (value, key) {
        if (value.completed === true) {
            await checkCompletedLog.info(
                `Completed Game Found in API: ${value.home_team} vs ${value.away_team}`,
            )
            if (
                inProgressCache.getKey(value.home_team) === null ||
                inProgressCache.getKey(value.home_team) === undefined
            ) {
                //#retrieve matchId with the team's found
                var hTeam = `${value.home_team}`
                var aTeam = `${value.away_team}`
                try {
                    var dbMatchId = await locateMatchup(hTeam, aTeam)
                    if (!dbMatchId || dbMatchId == false || dbMatchId == undefined) {
                        await checkCompletedLog.error(
                            `Unable to find a matchup matchup / ID for ${value.home_team} vs. ${value.away_team}`,
                        )
                        throw new Error(
                            `Unable to find a matchup / ID for ${value.home_team} vs. ${value.away_team}`,
                        )
                    }
                } catch (err) {
                    continue
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
                //# init the closeMatchups opeeration
                inProgressCache.setKey(value.home_team, true)
                var message = null
                await initCloseMatchups(message, dbMatchId, winner).then(async () => {
                    await checkCompletedLog.info(`Sent matchup ${dbMatchId} to be closed`)
                    container.processQueue++
                })
            } else {
                await checkCompletedLog.info(
                    `Bets for Matchup: ${value.home_team} vs. ${value.away_team} are already being closed. This game will not be queued to be processed.`,
                )
                continue
            }
        } else {
            await checkCompletedLog.error(
                `Skipped game between ${value.home_team} vs. ${value.away_team} as it was not completed yet.`,
            )
            continue
        }
    }
    await compGameMonitor.ping({
        state: 'complete',
        message: `Completed Finished Game Checks | Sent ${container.processQueue} Games to be closed`,
    })
}
