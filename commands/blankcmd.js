//? cmd for quick testing of functions

import { Command } from '@sapphire/framework'
import { Log } from '#config'
import { findOpponent } from '#utilDB/findOpponent'
import { resolveTeam } from '#cmdUtil/resolveTeam'

//import { sortCancelBet } from '../utils/cmd_res/CancelBet/sortCancelBet.js'

export class testCMD extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'testcmd',
            aliases: ['test'],
            description: 'testing functions',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }
    async messageRun(message, args) {
        var input = await args.rest('string').catch(() => null)
        var findT = await resolveTeam(input)
        let oppTeam = ''
        await findOpponent(message, findT).then((data) => {
            Log.Yellow(`[findOpponent.js] Located matching row`)
            if (data.teamone === findT) {
                oppTeam = data.teamtwo
            } else if (data.teamtwo === findT) {
                oppTeam = data.teamone
            }
        })
        console.log(oppTeam)
    }
}
