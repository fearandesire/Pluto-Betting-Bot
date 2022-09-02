//? gatherOdds.js: Gather all odds from API and return into an embed.
//? Since we store the information in an embed, we don't need to make repeated calls to the API.

import 'dotenv/config'

import { Command, container } from '@sapphire/framework'

import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import _ from 'lodash'
import { assignMatchID } from '../utils/bot_res/AssignIDs.js'
import fetch from 'node-fetch'
import flatcache from 'flat-cache'
import { matchupscreate } from '../utils/cmd_res/matchupscreate.js'
import { verifyDate } from '#api/verifyDate'

let oddsCache = flatcache.create(`oddsCache.json`, './cache/todaysOdds')
//import { SendMatchupList } from '../utils/bot_res/send_functions/SendMatchupList.js'

const url =
    // eslint-disable-next-line no-undef
    process.env.odds_API_NFLODDS
const options = {
    method: 'GET',
    headers: {
        'X-RapidAPI-Host': 'api.the-odds-api.com',
        'X-RapidAPI-Key': 'd5dcd70f44241e623b2c18a9b84a9941',
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
            aliases: ['getnflodds'],
            description: 'return matchups & odds for all available teams',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }

    async messageRun(message) {
        let matchups = {}
        container.allNflOdds = {}
        //* for caching and sending the cache
        // if (container.CollectedOdds === true) {
        //     SendMatchupList(message, container.MatchupList)
        //     return
        // }

        await fetch(url, options)
            .then((res) => res.json())
            .then((json) => {
                Log.Yellow(`[gatherOdds.js] Running gatherOdds.js!`)

                //? Returns the list of matchups
                var apiGamesList = json //? bookmarker = fan duel. markets
                container.allNflOdds = apiGamesList
            })
        var allNflOdds = container.allNflOdds
        //console.log(allNflOdds)
        container.matchupCount = 0
        await _.forEach(allNflOdds, async function (value, key) {
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
                matchups[key] = {
                    [`home_team`]: home_team,
                    [`away_team`]: away_team,
                    [`home_teamOdds`]: home_odds,
                    [`away_teamOdds`]: away_odds,
                }
                let matchupId = await assignMatchID()
                console.log(matchupId)
                await matchupscreate(
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
        console.log(matchups)
        oddsCache.setKey(`matchups`, matchups)
        oddsCache.save(true)
        message.reply(`Odds stored into cache & db. (${container.matchupCount})`)
        //container.CollectedOdds = true
    }
}
