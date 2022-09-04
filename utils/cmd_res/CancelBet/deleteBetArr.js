//? Delete bet from array

import {
    QuickError,
    embedReply,
} from '../../bot_res/send_functions/embedReply.js'

import { Log } from '../../bot_res/send_functions/consoleLog.js'
import _ from 'lodash'
import { storage } from '../../../lib/PlutoConfig.js'

/**
 * @module deleteBetFromArray -
 * A module that is apart of the cancelBet command, helping delete a bet from the user's betslip
 *
 *
 * @description Using a couple of libraries, this module will access local storage, find the index of the specified bet via the 'betid' parameter, and then delete it from the array.
 *
 *
 * We access the local storage we have setup with {@link https://www.npmjs.com/package/node-persist node-persist} (or, `storage` as referenced in the code) to retrieve the user's betslip information - which is stored in Discord Embed 'Fields' format.
 * We nest the array into another array that we create on-demand in memory to allow us to manipulate the information.
 * Then we utilize the Lodash library to find the index of the bet via the 'betid', and use that to delete the relevant bet information.
 * To provide insight on why exactly we delete the index and the additional 2 indexs' following, it is important to understand the structure of the array.
 *
 *  The array is structured as follows:
 * ```key: 'userid-activeBetSlips', value: [`name: 'betid', value: 'integer'`, `name: 'amount', value: 'integer'`, `name: 'TeamID', value: 'text'`]```
 *
 * The 3 indexes above are the betid, amount, and TeamID. This information repeats in 3's for each bet that is created. Therefor, we delete 3 indexes total from where the 'betid' starts,
 * as the next 2 are relevant to the same bet.
 * @param {integer} userid
 * @param {integer} betid
 * @param {obj} message
 * @var {obj} betslipArray - The object containing the array of the user's 'betslip' - which is stored in Discord Embed 'Fields' format.
 * @var {array} MemoryArray - Created & used to store the user's betslip information.
 * @function updateArray - This will handle the updating of the user's betslip information array once we have gathered the information we need.
 * @references -
 * {@link cancelBet}
 * {@link }
 */

//todo: add in Lodash .findIndex
export async function deleteBetFromArray(userid, betid, message) {
    await storage.init()
    try {
        //todo: change betslipArray to call from local storage
        //var betslipArray = Memory_Betslips[`${userid}`].betslip
        //? Get the betslip array from local storage linked to the user via their ID
        var betslipArray = await storage.get(`${userid}-activeBetslips`)
        //? Setting up a variable to hold the betslip Array we retrieve from local storage
        var MemoryArray = []
        MemoryArray.push(betslipArray)
        //? Find Index of the specified bet in the betslip array so we can remove it
        const betIndex = _.findIndex(MemoryArray[0], {
            // prettier-ignore
            'value': `${betid}`,
        })
        //? To verify our data is correct, logging the index of the bet and the 'MemoryArray'
        Log.Yellow(`[deleteBetArr.js] Index of Bet ${betid} in Array: ${betIndex}`)
        Log.Yellow(`[deleteBetArr.js] MemoryArray: ${JSON.stringify(MemoryArray)}`)
        //? I forgot why I put this into an arrow function, but:
        //? We flatten the 'MemoryArray' as we have no further use for the data being nested
        var updateArray = async (userid, betslipArray, betIndex, MemoryArray) => {
            var flat = _.flatten(MemoryArray)
            //? Using the index of the bet ID, we will remove all related data from the array. We utilize Lodash's .pullAt function to remove them while keeping the array in tact.
            var pulled = await _.pullAt(flat, [betIndex, betIndex + 1, betIndex + 2])
            var storeBetLocally = await storage.set(`${userid}-activeBetslips`, flat)
            await Log.BrightBlue(
                `[deleteBetArr.js] Flattened Array:` +
                    JSON.stringify(flat) +
                    `\n` +
                    `[deleteBetArr.js] Pulled Array:` +
                    JSON.stringify(pulled),
            )
        }
        updateArray(userid, betslipArray, betIndex, MemoryArray)
        Log.Yellow(
            `[deleteBetFromArray.js] Collected Betslip for ${userid}` +
                `\n` +
                JSON.stringify(betslipArray),
        )
        Log.Green(
            `[deleteBetArr.js] Successfully deleted bet #${betid} from Local Storage Betslips array for ${userid}`,
        )
        var embedcontents = {
            title: `Bet Cancellation`,
            description: `Successfully deleted bet #${betid} from your betslip`,
            color: 'GREEN',
        }
        embedReply(message, embedcontents)
    } catch (err) {
        QuickError(message, `Unable to locate bet #${betid}`)
        Log.Red(err)
        throw Log.Error(
            `[deleteBetFromArray.js] Error: Unable to locate bet #${betid} for deletion. -- requested by: ${userid}\n${err}`,
        )
    }
}
