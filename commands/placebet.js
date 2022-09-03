import { Command } from '@sapphire/framework'
import { FileRunning } from '../utils/bot_res/classes/FileRunning.js'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { QuickError } from '../utils/bot_res/send_functions/embedReply.js'
import async from 'async'
import { insufficientFunds } from '../utils/cmd_res/insufficientFunds.js'
import { processTrans } from '../utils/cmd_res/processTrans.js'
import { resolveTeam } from '#cmdUtil/resolveTeam'
import { setupBet } from '../utils/cmd_res/setupBet.js'
import { validateUser } from '../utils/cmd_res/validateExistingUser.js'
import { verifyDupBet } from '../utils/cmd_res/verifyDuplicateBet.js'

export class placebet extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'placebet',
            aliases: ['bet', 'pbet'],
            description: 'Place Bet (test',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }

    async messageRun(message, args) {
        new FileRunning(this.name) //? Log command running
        var betAmount = await args.pick('number').catch(() => null)
        var betOnTeam = await args.rest('string').catch(() => null)
        if (!betOnTeam) {
            //# null input
            QuickError(message, 'Please enter a team or match id')
        }
        betOnTeam = await resolveTeam(betOnTeam)
        if (!betOnTeam) {
            //# failure to match team
            QuickError(message, 'Please enter a valid team or match id')
        }
        var user = message.author.id //? user id
        await Log.Yellow(
            `[${this.name}.js] User ${message.author.username} (${message.author.id}) is getting a bet ready!`, //? Debug purposes, this will likely be removed later. For now, it's intended to confirm the user's input
        )
        await Log.Blue(`Bet Slip:\nAmount: ${betAmount}\nTeam: ${betOnTeam}`)
        async.series(
            [
                async function valUser() {
                    await validateUser(message, user)
                    return
                },
                async function verDup() {
                    await verifyDupBet(user, betOnTeam, message)
                    return
                },
                async function insufFunds() {
                    var checkFunds = await insufficientFunds(message, user)
                    if (!checkFunds) {
                        QuickError(
                            message,
                            `Unable to locate any balance for your account in the database.`,
                        )
                        throw new Error(
                            `User ${message.author.username} (${message.author.id}) does not have sufficient funds to place their bet. [Unable to locate any balance for your account in the database]`,
                        )
                    }
                    return
                },
                async function procTran(insufFunds) {
                    await processTrans(message, user, insufFunds, betAmount, betOnTeam)
                    return
                },
                async function setBet() {
                    await setupBet(message, betOnTeam, betAmount)
                    return
                },
            ],
            function (err) {
                if (err) {
                    Log.Red(err)
                }
            },
        )
    }
}
