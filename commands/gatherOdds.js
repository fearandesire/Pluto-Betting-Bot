//? gatherOdds.js: Gather all odds from API and return into an embed.
//? Since we store the information in an embed, we don't need to make repeated calls to the API.

import 'dotenv/config'

import { Command } from '@sapphire/framework'
import flatcache from 'flat-cache'
import { collectOdds } from '../utils/api/collectOdds.js'

let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')
//import { SendMatchupList } from '../utils/bot_res/send_functions/SendMatchupList.js'

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
//TODO: Adjust API to in-season sport
//TODO: Compile information into Database 'activematchups' table, then use that same information to display info back (via Embed)
//TODO: Return information & configure SendMatchupList to send stored information
export class nflodds extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'nflodds',
			aliases: ['getnflodds', 'getodds', 'gatherodds'],
			description: 'return matchups & odds for all available teams',
		})
	}

	async messageRun(message) {
		await collectOdds(message)
	}
}
