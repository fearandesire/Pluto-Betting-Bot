import _ from 'lodash'
import { checkCompletedLog } from '#winstonLogger'
import { container } from '#config'
import fetch from 'node-fetch'
import { initCloseMatchups } from '#utilMatchups/initCloseMatchups'
import { resolveMatchup } from '#cacheUtil/resolveMatchup'
import stringifyObject from 'stringify-object'

const url = process.env.odds_API_NFLSCORE
const options = {
    method: 'GET',
    headers: {
        'X-RapidAPI-Host': 'api.the-odds-api.com',
        'X-RapidAPI-Key': process.env.odds_API_XKEY,
    },
}

/**
 * @module checkCompleted -
 * Call the odds-api and check for completed games via 'get' score. Completed games have their score compared and the winning team and matchup is sent to be closed via [initCloseMatchups.js](../closeMatchups/initCloseMatchups.js)
 */

export async function checkCompleted() {
    checkCompletedLog.info(`Initilization API Call for completed games`)
    await fetch(url, options)
        .then((res) => res.json())
        .then((json) => {
            checkCompletedLog.info(`API Connection successful`)
            var apiCompletedResult = json
            container.apiCompResult = apiCompletedResult
        })
    var compResults = container.apiCompResult
    checkCompletedLog.info(`API Connection Information:`)
    checkCompletedLog.info(stringifyObject(compResults))
    await _.forEach(compResults, async function (value, key) {
        if (value.completed === true) {
            checkCompletedLog.info(
                `Completed Game Found in API: ${value.home_team} vs ${value.away_team}`,
            )
            //#retrieve matchId with the team's found
            var hTeam = value.home_team
            var aTeam = value.away_team
            try {
                var dbMatchId = (await resolveMatchup(hTeam).matchupId)
                    ? await resolveMatchup(hTeam).matchupId
                    : await resolveMatchup(aTeam).matchupId
                if (!dbMatchId || dbMatchId == false) {
                    checkCompletedLog.error(
                        `Unable to find a matchup ID for ${value.home_team}`,
                    )
                    throw new Error(`Unable to find a matchup ID for ${value.home_team}`)
                }
            } catch (err) {
                return
            }
            dbMatchId = Number(dbMatchId)
            checkCompletedLog.info(
                `MatchId Found: ${dbMatchId} - ${value.home_team} vs ${value.away_team}`,
            )
            //# determine winner based on the scores
            var homeScore = value.scores[0].score
            var awayScore = value.scores[1].score
            var winner = ''
            if (homeScore > awayScore) {
                winner = value.home_team
                checkCompletedLog.info(`Winner: - Home Team: ${winner} - ${homeScore}`)
            } else if (homeScore < awayScore) {
                winner = value.away_team
                checkCompletedLog.info(`Winner: - Away Team: ${winner} - ${awayScore}`)
            }
            //# init the closeMatchups opeeration
            var message = null
            await initCloseMatchups(message, dbMatchId, winner)
        } else {
            checkCompletedLog.info(`Skipped game as it was not completed yet.`)
        }
    })
}
