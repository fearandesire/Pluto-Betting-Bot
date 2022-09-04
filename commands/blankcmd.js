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
        var firstTeam = input
        var findT = await resolveTeam(input)
        let oppTeam = ''
        await findOpponent(message, findT).then((data) => {
            console.log(data)
            Log.Yellow(`[findOpponent.js] Located matching row`)
            //console.log(`${key}: ${value}`)
            if (data.teamone === firstTeam) {
                oppTeam = data.teamtwo
            } else if (data.teamtwo === firstTeam) {
                oppTeam = data.teamone
            }
        })
        console.log(oppTeam)
    }
}
