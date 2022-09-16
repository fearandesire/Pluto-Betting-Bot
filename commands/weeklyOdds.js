import 'dotenv/config'

import { Log, QuickError, _, embedReply, flatcache } from '#config'

import { Command } from '@sapphire/framework'
import { formatOdds } from '../utils/bot_res/formatOdds.js'

export class weeklyOdds extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'weeklyodds',
            aliases: [
                'odds',
                'thisweek',
                'weekodds',
                'thisweekodds',
                'oddsweekly',
                'weekly',
            ],
            description: 'Returns all odds stored.',
        })
    }

    async messageRun(message) {
        Log.Yellow(`[todaysodds.js] Running weeklyOdds.js!`)
        let oddsCache = flatcache.create(`oddsCache.json`, './cache/weeklyOdds')
        var matchupCache = oddsCache.getKey(`matchups`)
        if (!matchupCache || Object.keys(matchupCache).length === 0) {
            QuickError(message, 'No odds available to view.')
            return
        }
        var oddsFields = []
        await _.forEach(matchupCache, async (matchFound) => {
            var hTeam = matchFound.home_team
            var aTeam = matchFound.away_team
            var hOdds = matchFound.home_teamOdds
            var aOdds = matchFound.away_teamOdds
            var matchupId = matchFound.matchupId
            var dateTitle = matchFound.dateView
            let oddsFormat = await formatOdds(hOdds, aOdds)
            hOdds = oddsFormat.homeOdds
            aOdds = oddsFormat.awayOdds
            oddsFields.push({
                name: `• ${dateTitle}`,
                value: `**${hTeam}**\nOdds: *${hOdds}*\n**${aTeam}**\nOdds: *${aOdds}*\n──────`,
                inline: true,
            })
        })
        var embedObj = {
            title: `Weekly H2H Odds`,
            fields: oddsFields,
            footer:
                'Favored teams have a - negative number | Pluto - Designed by FENIX#7559',
        }
        embedReply(message, embedObj)
    }
}
