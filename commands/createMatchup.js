//? Intended to create a matchup to bet on - in the event of an API failure, this will be a backup plan.
//? This can also be used to create custom matchups for fun, to test the bot, or for sports that we have not integrated for the bot yet.

import { Command } from '@sapphire/framework'
import { FileRunning } from '#botClasses/FileRunning'
import { Log } from '#LogColor'
import { assignMatchID } from '#botUtil/AssignIDs'
import { createMatchups } from '#utilMatchups/createMatchups'

export class creatematchup extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'creatematchup',
            aliases: ['create', 'cm', 'cmatchup'],
            description: 'Create Matchup',
            requiredUserPermissions: ['MANAGE_MESSAGES'],
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
        await createMatchups(
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
