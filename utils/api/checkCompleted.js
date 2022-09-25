import _ from 'lodash'
import { checkCompletedLog } from '../logging.js'
import { container } from '#config'
import fetch from 'node-fetch'
import { initCloseMatchups } from '../closeMatchups/initCloseMatchups.js'
import { resovleMatchup } from '../cache/resolveMatchup.js'

const url =
	// eslint-disable-next-line no-undef
	process.env.odds_API_NFLSCORE
const options = {
	method: 'GET',
	headers: {
		'X-RapidAPI-Host': 'api.the-odds-api.com',
		// eslint-disable-next-line no-undef
		'X-RapidAPI-Key': process.env.odds_API_XKEY2,
	},
}

/* 
# API Scores Response Schema
[    
{
        "id": "6bde759afa450fe673e70e555be88ba4",
        "sport_key": "americanfootball_nfl",
        "sport_title": "NFL",
        "commence_time": "2022-09-09T00:20:00Z",
        "completed": false,
        "home_team": "Los Angeles Rams",
        "away_team": "Buffalo Bills",
        "scores": null,
        "last_update": null
    },
    etc
    
    & If the game is live or completed, the score property will be an array containing the following information.
    "scores": [
        {
        name: 'home_team_name',
        score: 'integer'
        },
        {
        name: 'away_team_name',
        score: 'integer'
        }
    ]
]
*/

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
	await _.forEach(compResults, async function (value, key) {
		if (value.completed === true) {
			checkCompletedLog.info(
				`Completed Game Found: ${value.home_team} vs ${value.away_team}`,
			)
			//#retrieve matchId with the team's found
			var hTeam = value.home_team
			var aTeam = value.away_team
			var dbMatchId = (await resovleMatchup(hTeam).matchupId)
				? await resovleMatchup(hTeam).matchupId
				: await resovleMatchup(aTeam).matchupId
			if (!dbMatchId) {
				checkCompletedLog.info(
					`Unable to find a matchup ID for ${value.home_team}`,
				)
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
