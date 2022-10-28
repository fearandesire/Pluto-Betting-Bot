import { NFL_ACTIVEMATCHUPS, ODDS_NFL, _, container, flatcache } from '#config'

import { collectOddsLog } from '#winstonLogger'
import { db } from '#db'
import fetch from 'node-fetch'
import { locateMatchup } from '../db/matchupOps/locateMatchup.js'

let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')

/**
 * @module updateOdds
 * Update odds in Database and Cache. Used to periodically update odds.
 */

const url = ODDS_NFL
const options = {
	method: 'GET',
	headers: {
		'X-RapidAPI-Host': 'api.the-odds-api.com',
		// eslint-disable-next-line no-undef
		'X-RapidAPI-Key': process.env.odds_API_XKEY,
	},
}

export async function updateOdds() {
	container.allNFLOdds = {}
	await fetch(url, options)
		.then((res) => res.json())
		.then((json) => {
			collectOddsLog.info(`Initializing odds collection - Update`)
			//? Returns the list of matchups
			var apiGamesList = json
			container.allNFLOdds = apiGamesList
		})
	var allNFLOdds = container.allNFLOdds
	for (let [key, value] of Object.entries(allNFLOdds)) {
		let selectedOdds = value?.bookmakers[0]?.markets[0].outcomes
			? value.bookmakers[0]?.markets[0].outcomes
			: null
		let home_odds
		let away_odds
		let homeTeam = value.home_team
		let awayTeam = value.away_team
		if (selectedOdds) {
			var findHomeOdds = _.find(selectedOdds, { name: `${homeTeam}` })
			var findAwayOdds = _.find(selectedOdds, { name: `${awayTeam}` })
			home_odds = findHomeOdds.price
			away_odds = findAwayOdds.price
		}
		await db.manyOrNone(
			`
    UPDATE "${NFL_ACTIVEMATCHUPS}" SET teamoneodds = $1, teamtwoodds = $2 WHERE teamone = $3 AND teamtwo = $4
    `,
			[home_odds, away_odds, homeTeam, awayTeam],
		)
		await console.log(
			`Updated DB Odds for ${homeTeam} vs ${awayTeam} || Odds: ${home_odds} vs ${away_odds}`,
		)
		//# Update the cache with the odds
		let cachedOdds = oddsCache.getKey(`matchups`)

		var locateMatchId = await locateMatchup(homeTeam, awayTeam)
		if (!locateMatchId) {
			continue
		}
		if (
			cachedOdds[`${locateMatchId}`].home_team == homeTeam &&
			cachedOdds[`${locateMatchId}`].away_team == awayTeam
		) {
			value.teamoneodds = home_odds
			value.teamtwoodds = away_odds
			await console.log(
				`Updated Cached Odds for: ${homeTeam} vs ${awayTeam} || Odds: ${home_odds} vs ${away_odds}`,
			)
			oddsCache.save(true)
		} else {
			await console.log(
				`Unable to locate matchup ${homeTeam} vs ${awayTeam} in cache. Skipping update for this match.`,
			)
			continue
		}
	}

	console.log(`updated odds`)
}
