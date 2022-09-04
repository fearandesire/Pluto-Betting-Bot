import { Command } from '@sapphire/framework'
import { FileRunning } from '../utils/bot_res/classes/FileRunning.js'
import { Log } from '../utils/bot_res/send_functions/consoleLog.js'
import { QueryBets } from '../utils/cmd_res/CancelBet/queryBets.js'
import { deleteBetFromArray } from '../utils/cmd_res/CancelBet/deleteBetArr.js'
import { storage } from '../lib/PlutoConfig.js'
import { verifyBetAuthor } from '../utils/cmd_res/CancelBet/verifyBetAuthor.js'

/**
 * @command cancelBet -
 * Cancels a bet that the user has placed.
 * @param {object} message - The Discord message object. Used to reply to the user.
 * @var userid - The Discord user Id of who called the command.
 * @var betid - The Id of the bet being requested to be cancelled / manipulated.
 * @function verifyBetAuthor - Verifies the author of the bet being requested to be cancelled / manipulated.
 * @function QueryBets - Queries the database for the bet being requested to be cancelled / manipulated - deletes if found from relevant locations (see for more info)
 * @function deleteBetFromArray - Deletes the bet from local storage.
 */

//TODO: error catch betid for null argument;
//TODO: update currency when the bet is cancelled (within QueryBets)
export class cancelBet extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'cancelbet',
            aliases: ['cbet', 'cancel'],
            description: 'Cancel a specified bet.',
            requiredUserPermissions: ['KICK_MEMBERS'],
        })
    }
    async messageRun(message, args) {
        new FileRunning(this.name) //? Log file running
        storage.init()
        Log.Border
        var betid = await args.pick('number').catch(() => null)
        var userid = message.author.id
        await verifyBetAuthor(message, userid, betid) //? Verify the bet belongs to the user
        await QueryBets(userid, betid) //? Query DB & delete specified bet
        await deleteBetFromArray(userid, betid, message) //? Update our local storage with the new betslip for the user (for displaying bet info to user)
    }
}
