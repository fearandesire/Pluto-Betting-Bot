//? gatherOdds.js: Gather all odds from API and return into an embed.
//? Since we store the information in an embed, we don't need to make repeated calls to the API.

import 'dotenv/config'

import { Command } from '@sapphire/framework'
import { collectOdds } from '../utils/api/collectOdds.js'
import flatcache from 'flat-cache'

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
        'X-RapidAPI-Key': process.env.odds_API_XKEY,
    },
}
/**
 * @module nflOdds
 * Manually request the API for the odds for the week.
 */

export class nflOdds extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'nflOdds',
            aliases: ['getnflodds', 'getodds', 'gatherodds'],
            description: 'Retrieve all odds for the week via the-odds-API',
            requiredUserPermissions: ['MANAGE_MESSAGES'],
        })
    }

    async messageRun(message) {
        await collectOdds(message)
    }
}
