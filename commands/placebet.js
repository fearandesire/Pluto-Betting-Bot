import { Command } from '@sapphire/framework'
import { FileRunning } from '../utils/bot_res/classes/FileRunning.js'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { QuickError } from '../utils/bot_res/send_functions/embedReply.js'
import async from 'async'
import { insufficientFunds } from '../utils/cmd_res/insufficientFunds.js'
import { processTrans } from '../utils/cmd_res/processTrans.js'
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
        //* Gather user input
        var inputAmount = await args.pick('number').catch(() => null) //? Amount user wants to bet
        //? The 'teamID' is the identifier for the 'team' the user wants to bet on
        var inputTeamID = await args.pick('string').catch(() => null) //! A list will be in place (gatherodds embed) with assosciated team IDs, and we will need to possibly setup flags to stop invalid teamID input
        var user = message.author.id //? user id
        await Log.Yellow(
            `[${this.name}.js] User ${message.author.username} (${message.author.id}) is getting a bet ready!`, //? Debug purposes, this will likely be removed later. For now, it's intended to confirm the user's input
        )
        await Log.Blue(`Bet Slip:\nAmount: ${inputAmount}\nTeamID: ${inputTeamID}`)
        // //? register user if they are not already registered
        // await registerUser(user)
        // //* Check if user is duplicating their bet // throws error if user has already placed a bet on that team
        // await verifyDupBet(user, inputTeamID, message)
        // //* Check if user has sufficient funds // throws error if user does not have sufficient funds to place their bet
        // await verifyFunds(message, user, inputAmount, inputTeamID)
        // //* Initiate process to place the bet
        // await setupBet(message, inputTeamID, inputAmount)
        //? run all of the above functions within an async series of actions
        async.series(
            [
                async function valUser() {
                    await validateUser(message, user)
                    return
                },
                async function verDup() {
                    await verifyDupBet(user, inputTeamID, message)
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
                    await processTrans(
                        message,
                        user,
                        insufFunds,
                        inputAmount,
                        inputTeamID,
                    )
                    return
                },
                async function setBet() {
                    await setupBet(message, inputTeamID, inputAmount)
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
