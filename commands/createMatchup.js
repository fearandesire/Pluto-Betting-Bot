//? Intended to create a matchup to bet on - in the event of an API failure, this will be a backup plan.
//? This can also be used to create custom matchups for fun, to test the bot, or for sports that we have not integrated for the bot yet. [Currently deisgned for NBAC]

import { Command } from '@sapphire/framework'
import { FileRunning } from '../utils/bot_res/classes/FileRunning.js'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { assignMatchID } from '../utils/bot_res/AssignIDs.js'
import { matchupscreate } from '../utils/cmd_res/matchupscreate.js'

export class creatematchup extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'creatematchup',
            aliases: ['create', 'cm', 'cmatchup'],
            description: 'Create Matchup',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }
    async messageRun(message, args) {
        //* Gather user input
        //? format: 'creatematchup [team1] [team2] [bet amount] [bet type]'
        var teamone = await args.pick('string').catch(() => null) //? Team one
        var teamtwo = await args.pick('string').catch(() => null) //? Team two
        var teamoneodds = await args.pick('number').catch(() => null) //? Team one
        var teamtwoodds = await args.pick('number').catch(() => null) //? Team two
        var assignMatchupIds = assignMatchID()
        await matchupscreate(
            message,
            teamone,
            teamtwo,
            teamoneodds,
            teamtwoodds,
            assignMatchupIds,
        )

        Log.Border()
        new FileRunning(this.name)
    }
}
