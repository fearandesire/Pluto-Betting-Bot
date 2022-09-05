//? cmd for quick testing of functions

import { Command } from '@sapphire/framework'
import extend from 'extend-shallow'
import { flatcache } from '#config'
import { retrieveMatchedID } from '#utilDB/retrieveMatchedID'

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
        var input = await args.pick('number').catch(() => null)
        let pendingSlips = flatcache.create(
            'pendingSlipCache.json',
            './cache/pendingSlipCache',
        )
        input = parseInt(input)
        await retrieveMatchedID(input).then(async (data) => {
            //console.log(data)
            var currentSlip = pendingSlips.getKey(`pendingSlips`)
            //# iterate through array of bets and store per match id nested unique details by the userid containing their bet information
            for (let i = 0; i < data.length; i++) {
                const bet = data[i]
                const betUserId = bet.userid
                const teamUserBet = bet.teamid
                const betAmount = bet.amount
                const betId = bet.betid
                const betMatchId = bet.matchid
                var usersSlip = {
                    [`${betUserId}`]: {
                        teamBetOn: teamUserBet,
                        betAmount: betAmount,
                        betId: betId,
                    },
                }
                if (currentSlip[`${betMatchId}`] === undefined) {
                    pendingSlips.setKey(`pendingSlips`, {
                        [`${betMatchId}`]: {},
                    })
                    currentSlip = pendingSlips.getKey(`pendingSlips`)[`${betMatchId}`]
                }
                var extended = await extend(currentSlip, usersSlip)
                pendingSlips.setKey(`pendingSlips`, extended)
                pendingSlips.save(true)
                console.log(currentSlip)
            }
        })
    }
}
