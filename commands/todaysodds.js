import 'dotenv/config'

import { Log, _, embedReply, flatcache } from '#config'

import { Command } from '@sapphire/framework'

export class todaysodds extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'todaysodds',
            aliases: ['odds', 'todaysodds'],
            description: 'Returns all odds stored.',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }

    async messageRun(message) {
        Log.Yellow(`[todaysodds.js] Running todaysodds.js!`)
        let oddsCache = flatcache.create(`oddsCache.json`, './cache/todaysOdds')
        var matchupOdds = oddsCache.getKey(`matchups`)
        var oddsFields = []
        await _.forEach(matchupOdds, (matchFound) => {
            var hTeam = matchFound.home_team
            var aTeam = matchFound.away_team
            var hOdds = matchFound.home_teamOdds
            var aOdds = matchFound.away_teamOdds
            var matchupId = matchFound.matchupId
            oddsFields.push({
                name: `Matchup #${matchupId}`,
                value: `Home Team:\n**${hTeam}**\nOdds: *${hOdds}*\nAway Team:\n**${aTeam}**\nOdds: *${aOdds}*`,
                inline: true,
            })
        })
        var embedObj = {
            title: `Today's H2H Odds`,
            fields: oddsFields,
            footer:
                'Favored teams have a - negative number | Pluto - Designed by FENIX#7559',
        }
        embedReply(message, embedObj)
    }
}
