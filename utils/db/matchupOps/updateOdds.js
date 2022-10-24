import { ODDS_NFL, container, flatcache } from '#config'

import { collectOddsLog } from '../../logging.js'
import { db } from '#db'
import fetch from 'node-fetch'
import { locateMatchup } from './locateMatchup.js'

let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')

/**
 * @module updateOdds
 * Update odds in Database and Cache without replacing any other information
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
    let matchups = {} //# to store matchups into cache
    container.allNflOdds = {}
    await fetch(url, options)
        .then((res) => res.json())
        .then((json) => {
            collectOddsLog.info(`Initializing odds collection - Update`)
            //? Returns the list of matchups
            var apiGamesList = json
            container.allNflOdds = apiGamesList
        })
    var allNflOdds = container.allNflOdds
    for (let [key, value] of Object.entries(allNflOdds)) {
        var selectedOdds = value?.bookmakers[0]?.markets[0].outcomes
            ? value.bookmakers[0]?.markets[0].outcomes
            : null
        let home_odds
        let away_odds
        let homeTeam = value.home_team
        let awayTeam = value.away_team
        if (selectedOdds) {
            home_odds = selectedOdds[1].price
            away_odds = selectedOdds[0].price
        }
        await db.manyOrNone(
            `
    UPDATE activematchups SET teamoneodds = $1, teamtwoodds = $2 WHERE teamone = $3 AND teamtwo = $4
    `,
            [home_odds, away_odds, homeTeam, awayTeam],
        )
        await console.log(
            `Updated DB odds for ${homeTeam} vs ${awayTeam} || Odds: ${home_odds} vs ${away_odds}`,
        )
        //# Update the cache with the odds
        let cachedOdds = oddsCache.getKey(`matchups`)

        var locateMatchId = await locateMatchup(homeTeam, awayTeam)
        if (
            cachedOdds[`${locateMatchId}`].home_team == homeTeam &&
            cachedOdds[`${locateMatchId}`].away_team == awayTeam
        ) {
            value.teamoneodds = home_odds
            value.teamtwoodds = away_odds
            await console.log(
                `odds for: ${homeTeam} vs ${awayTeam} updated || Odds: ${home_odds} vs ${away_odds}`,
            )
            oddsCache.save(true)
        }
    }

    console.log(`updated odds`)
}
