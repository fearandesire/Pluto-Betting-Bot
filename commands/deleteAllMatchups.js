import { Log, QuickError, flatcache } from '#config'

import { Command } from '@sapphire/framework'
import { db } from '#db'

export class deleteAllMatchups extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'deleteAllMatchups',
            aliases: ['clearmatchups'],
            description: 'Delete all matchups in the database & cache',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }
    async messageRun(message) {
        Log.Red(`${message.author.tag} cleared all current matchups`)
        await db
            .oneOrNone(`DELETE FROM activematchups`)
            .catch(() => QuickError(message, `Error deleting all matchups.`))
        var oddsCache = flatcache.create(`oddsCache.json`, './cache/todaysOdds')
        var matchupCache = oddsCache.getKey(`matchups`)
        if (!matchupCache || Object.keys(matchupCache).length === 0) {
            QuickError(
                message,
                `Unable to delete matchups from cache, but the database has been cleared.`,
            )
            return
        }
        await oddsCache.removeKey(`matchups`)
        oddsCache.save(true)
        message.reply(`Successfully cleared all matchups in the DB & cache`)
        return
    }
}
