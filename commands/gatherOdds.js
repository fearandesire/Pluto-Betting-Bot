//? gatherOdds.js: Gather all odds from API and return into an embed.
//? Since we store the information in an embed, we don't need to make repeated calls to the API.

import 'dotenv/config'

import { Command, container } from '@sapphire/framework'

import _ from 'lodash'
import { assignMatchID } from '../utils/bot_res/AssignIDs.js'
import { createMatchups } from '../utils/cmd_res/createMatchups.js'
import fetch from 'node-fetch'
import flatcache from 'flat-cache'
import { gatherOddsLog } from '../utils/logging.js'
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
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }

    async messageRun(message) {
        let matchups = {} //# to store matchups into cache
        container.allNflOdds = {}
        container.err = 1
        //* for caching and sending the cache
        // if (container.CollectedOdds === true) {
        //     SendMatchupList(message, container.MatchupList)
        //     return
        // }

        await fetch(url, options)
            .then((res) => res.json())
            .then((json) => {
                gatherOddsLog.info(
                    `Initializing API Call for gathering NFL odds information`,
                )
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
                let matchupId = await assignMatchID()
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
                    [`matchupId`]: matchupId,
                }
                await createMatchups(
                    message,
                    home_team,
                    away_team,
                    home_odds,
                    away_odds,
                    matchupId,
                )

                // end of map
            }
        })

        gatherOddsLog.info(
            `Matchups Stored into Cache (# Of Matches ${container.matchupCount}):`,
        )
        if (_.isEmpty(matchups)) {
            message.reply(`Error occured while collecting & storing matchups.`)
            return
        }
        gatherOddsLog.info(JSON.stringify(matchups))
        oddsCache.setKey(`matchups`, matchups)
        oddsCache.save(true)
        message.reply(
            `Odds stored into cache & db. (# Of Matches: ${container.matchupCount})`,
        )
        //container.CollectedOdds = true
    }
}
