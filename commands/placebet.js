import { Command } from '@sapphire/framework'
import { FileRunning } from '#botClasses/FileRunning'
import { QuickError } from '#embed'
import _ from 'lodash'
import { newBet } from '#utilBetOps/newBet'
import { resolveTeam } from '#cmdUtil/resolveTeam'

export class placebet extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'bet',
            aliases: [''],
            description: 'Place Bet (test)',
        })
    }

    async messageRun(message, args) {
        new FileRunning(this.name) //? Log command running
        var betAmount = await args.pick('number').catch(() => null)
        var betOnTeam = await args.rest('string').catch(() => null)
        if (!betOnTeam) {
            //# null input
            QuickError(message, 'Please enter a team or match id')
            return
        }
        betOnTeam = await resolveTeam(betOnTeam)
        if (!betOnTeam) {
            //# failure to match team
            QuickError(message, 'Please enter a valid team or match id')
            return
        } else {
            console.log(`[placebet.js] betOnTeam: ${betOnTeam}`)
        }
        if (!betAmount || !_.isNumber(betAmount) || betAmount < 1) {
            QuickError(message, `Please provide a valid amount to bet.`)
            return
        }
        if (betAmount.toString().includes('.')) {
            QuickError(message, `Please provide a whole number to bet with.`)
            return
        }
        await newBet(message, betOnTeam, betAmount)
    }
}
