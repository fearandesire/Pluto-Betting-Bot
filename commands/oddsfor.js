import 'dotenv/config'

import { Log, QuickError, _, embedReply, flatcache } from '#config'

import { Command } from '@sapphire/framework'
import { resolveTeam } from '#cmdUtil/resolveTeam'

export class oddsfor extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'oddsfor',
            aliases: ['oddsfor'],
            description: 'Returns odds for specified team',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }

    async messageRun(message, args) {
        Log.Yellow(`[oddsfor.js] Running oddsfor.js!`)
        let oddsCache = flatcache.create(`oddsCache.json`, './cache/todaysOdds')
        var input = await args.rest('string').catch(() => null)
        if (!input) {
            QuickError(message, 'Please specify a team to get odds for')
            return
        }
        var teamName = await resolveTeam(input)
        if (!teamName) {
            QuickError(message, 'Please specify a valid team to get odds for')
            return
        }
        console.log(teamName)
        var matchupCache = oddsCache.getKey(`matchups`)
        if (!matchupCache || Object.keys(matchupCache).length === 0) {
            QuickError(message, 'No odds available')
            return
        }
        _.forEach(matchupCache, (matches) => {
            console.log(matches)
            if (matches.home_team === teamName || matches.away_team === teamName) {
                var hTome = matches.home_team
                var aTome = matches.away_team
                var hTomeOdds = matches.home_teamOdds
                var aTomeOdds = matches.away_teamOdds
                var embedObj = {
                    title: `Matchup #${matches[`matchupId`]}`,
                    description: `Home Team: **${hTome}** @ *${hTomeOdds}*\nAway Team: **${aTome}** @ *${aTomeOdds}*`,
                    footer: `Team @ H2H Odds | Pluto - Designed by FENIX#7559`,
                }
                embedReply(message, embedObj)
            }
        })
    }
}
