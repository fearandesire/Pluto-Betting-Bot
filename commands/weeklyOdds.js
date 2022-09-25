import 'dotenv/config'

import { Command } from '@sapphire/framework'
import { Log } from '#config'
import { returnWeeklyOdds } from '../utils/cache/returnWeeklyOdds.js'

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
        await returnWeeklyOdds(message)
    }
}
