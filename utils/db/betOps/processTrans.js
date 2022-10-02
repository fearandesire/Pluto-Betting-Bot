import { FileRunning } from '#botClasses/FileRunning'

/**
 * @module processTrans.js -
 * Handles the verification of funds for a user via our DB query promise
 * @param {obj} message - The message object from discord.js
 * @param {integer} user - The user's ID
 * @param {integer} betamount - The amount of dollars the user is trying to bet.
 * @param {integer} teamid - The team that the user is betting on.
 * @references {@link placeBet.js} - Invoked via placeBet.js
 */

export async function processTrans(message, user, balance, betamount, teamid) {
    new FileRunning(`processTrans`)
    return
}
