import { Command } from '@sapphire/framework'
import { FileRunning } from '#botClasses/FileRunning'
import { Log } from '#config'
import { modifyAmount } from '#utilBetOps/modifyAmount'

export class modifyBet extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'modifyBet',
            aliases: ['changebet'],
            description: 'Modify an existing bet.',
        })
    }
    async messageRun(message, args) {
        new FileRunning(this.name) //? Log file running
        var betid = await args.pick('number').catch(() => null)
        var targetValue = await args.pick('string').catch(() => null)
        var newValue = await args.pick('string').catch(() => null)
        var userid = message.author.id
        var targetLowerCase = targetValue.toLowerCase()
        if (targetLowerCase == 'amount') {
            var newamount = parseInt(newValue)
            await modifyAmount(message, userid, betid, newamount) //? Modify the amount of the bet
        }
        if (targetLowerCase == 'team') {
            //@remind - add team modification
            //todo: add team modification functionality
            Log.Green(`[${this.name}] Modifying team of bet ${betid}`)
            return
        }
    }
}
