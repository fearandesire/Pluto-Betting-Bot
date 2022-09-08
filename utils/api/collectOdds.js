import { verifyDate } from '#api/verifyDate'
import { container } from '#config'
import flatcache from 'flat-cache'
import _ from 'lodash'
import fetch from 'node-fetch'
import { assignMatchID } from '../bot_res/AssignIDs.js'
import { msgBotChan } from '../bot_res/send_functions/msgBotChan.js'
import { createMatchups } from '../cmd_res/createMatchups.js'
import { collectOddsLog } from './../logging.js'

let oddsCache = flatcache.create(`oddsCache.json`, './cache/todaysOdds')
/**
 * Call the API and store the matchup odds for the week into the database & cache
 */
export async function collectOdds() {
	var message = null
	const url =
		// eslint-disable-next-line no-undef
		process.env.odds_API_NFLODDS
	const options = {
		method: 'GET',
		headers: {
			'X-RapidAPI-Host': 'api.the-odds-api.com',
			// eslint-disable-next-line no-undef
			'X-RapidAPI-Key': process.env.odds_API_XKEY2,
		},
	}
	let matchups = {} //# to store matchups into cache
	container.allNflOdds = {}
	//* for caching and sending the cache

	await fetch(url, options)
		.then((res) => res.json())
		.then((json) => {
			collectOddsLog.info(`Initializing collection of odds for the week`)
			//? Returns the list of matchups
			var apiGamesList = json
			container.allNflOdds = apiGamesList
		})
	var allNflOdds = container.allNflOdds
	container.matchupCount = 0
	await _.forEach(allNflOdds, async function (value, key) {
		//TODO: Remove today's date being 9-11 before going into Production
		//* only return by specified date
		var isoDate = value.commence_time
		if (verifyDate(isoDate)) {
			container.matchupCount = container.matchupCount + 1
			matchups[key] = value
			let home_odds
			let away_odds
			var home_team = value.home_team
			var away_team = value.away_team
			var selectedOdds = value?.bookmakers[0]?.markets[0].outcomes
				? value.bookmakers[0]?.markets[0].outcomes
				: null
			if (selectedOdds) {
				home_odds = selectedOdds[0].price
				away_odds = selectedOdds[1].price
			} else {
				home_odds = 'n/a'
				away_odds = 'n/a'
			}
			let matchupId = await assignMatchID()
			matchups[key] = {
				[`home_team`]: home_team,
				[`away_team`]: away_team,
				[`home_teamOdds`]: home_odds,
				[`away_teamOdds`]: away_odds,
				[`matchupId`]: matchupId,
			}
			console.log(matchupId)
			await createMatchups(
				message,
				home_team,
				away_team,
				home_odds,
				away_odds,
				matchupId,
			)
		}
		// end of map
	})
	if (_.isEmpty(matchups)) {
		await msgBotChan(
			`Issue occured while collecting & storing matchups. No Information has been stored.`,
			`error`,
		)
		collectOddsLog.error(
			`Issue occured while collecting & storing matchup. No Information has been stored.`,
		)
		return
	}

	collectOddsLog.info(`All Matchup information collected:`)
	collectOddsLog.info(matchups)
	oddsCache.setKey(`matchups`, matchups)
	oddsCache.save(true)
	collectOddsLog.info(
		`Successfully gathered odds for the week.\nOdds are stored into cache & db\n# Of Matchups Stored: (${container.matchupCount})`,
	)
	//container.CollectedOdds = true
}
