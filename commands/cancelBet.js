import { Command } from '@sapphire/framework'
import { FileRunning } from '../utils/bot_res/classes/FileRunning.js'
import { Log } from '#LogColor'
import { QueryBets } from '#utilBetOps/queryBets'
import { deleteBetFromArray } from '#utilBetOps/deleteBetArr'
import { verifyBetAuthor } from '#utilValidate/verifyBetAuthor'

/**
 * @command cancelBet -
 * Cancels a bet that the user has placed.
 * @param {object} message - The Discord message object. Used to reply to the user.
 * @var userid - The Discord user Id of who called the command.
 * @var betid - The Id of the bet being requested to be cancelled / manipulated.
 * @function verifyBetAuthor - Verifies the author of the bet being requested to be cancelled / manipulated.
 * @function QueryBets - Queries the database for the bet being requested to be cancelled / manipulated - deletes if found from relevant locations (see for more info)
 * @function deleteBetFromArray - Deletes the bet from local cache.
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
        })
    }
    async messageRun(message, args) {
        new FileRunning(this.name) //? Log file running
        Log.Border
        var betid = await args.pick('number').catch(() => null)
        var userid = message.author.id
        await verifyBetAuthor(message, userid, betid) //? Verify the bet belongs to the user
        await QueryBets(message, userid, betid) //? Query DB & delete specified bet
        await deleteBetFromArray(message, userid, betid) //? Update our local storage with the new betslip for the user (for displaying bet info to user)
    }
}
