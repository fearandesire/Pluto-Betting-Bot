import { AssignBetID } from '../bot_res/AssignIDs.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { addNewBet } from './addNewBet.js'
import flatcache from 'flat-cache'
import merge from 'deepmerge'
import { confirmBetEmbed as pleaseConfirmEmbed } from '../bot_res/send_functions/confirmBetEmbed.js'
import { sortBalance } from './sortBalance.js'
import { storage } from '../../lib/PlutoConfig.js'
let allbetSlipsCache = flatcache.create(
    `allbetSlipsCache.json`,
    './cache/betslips',
)
/**
 * @module confirmBet -
 * ⁡⁣⁣⁢Creates a message listener & collection for the user to confirm their bet. ⁡⁣⁣⁢The listener will be active for 60 seconds.⁡
 *⁡⁣⁣⁢ We want to timeout bets that aren't confirmed so we don't have any infinite hangups.⁡
 * @param {obj} message - The message object - contains the user info from Discord & allows us to reply to the user.
 * @param {obj} betslip - The bet information from the user input that we will have them confirm. Additionally, we tack on the matchid, and assign a betid to the bet.
 * @param {boolean} interactionEph - Whether the response should be visible to the user or not [slash cmd]
 * @returns - If the user confirms the bet, pushes bet to DB with {@link addNewBet} (which will provide a response to user) && subtracts/sorts their new balance with {@link sortBalance}
 * If the user does not confirm their bet in time, we inform them of such and end the event.
 * @references
 * - {@link setupBet.js} Calls confirmBet.js
 * - {@link addNewBet.js} Adds the bet to the DB
 * - {@link sortBalance.js} Sorts the user's balance [subtracting the bet amount, storing new balance]
 *
 */

export async function confirmBet(message, betslip, userId, interactionEph) {
    await storage.init()
    //? Sending Embed w/ bet details for the user to confirm bet
    await pleaseConfirmEmbed(message, betslip, interactionEph)
    //? Assigning a filter for the message collector to listen for. The colllection will identify the user by their ID
    //# for some reason, this wont work. Assigned a manaul check for the ID instead.
    const filter = (user) => {
        return user.id === userId
    }
    Log.Yellow(`[confirmBet.js] Started timer!`)
    //?  Create collection listener for the user to confirm their bet via message collection [Discord.js] on a 60 second timer.
    const collector = message.channel.createMessageCollector(filter, {
        time: 60000,
        error: 'time',
    })
    //? Using the '.on' event to listen for the user to confirm the bet
    collector.on('collect', async (message) => {
        if (
            (message.content.toLowerCase() === 'yes' &&
                message.author.id === userId) ||
            (message.content.toLowerCase() === 'confirm' &&
                message.author.id === userId)
        ) {
            console.log(`collected ID:`)
            console.log(message.author.id)
            collector.stop()
            var setBetID = AssignBetID()
            betslip.betid = setBetID
            Log.Green(
                `[confirmBet.js] ${
                    betslip.userid
                } confirmed a bet!\n Bet Slip:\n ${JSON.stringify(betslip)}`,
            )
            //? If user already has collected their list of bets via 'listBets', we need to allow them to retrieve a new list since they are adding to it.
            await storage.setItem(`${betslip.userid}-hasBetsEmbed`, false)
            var cacheTitle = `${betslip.userid}`
            await allbetSlipsCache.setKey(`${cacheTitle}-hasBetsEmbed`, false)
            if (allbetSlipsCache.getKey(`${cacheTitle}-activebetslips`) === null) {
                await allbetSlipsCache.setKey(`${cacheTitle}-activebetslips`, betslip)
            } else {
                //# utilize merge
                var currentBets = allbetSlipsCache.getKey(
                    `${cacheTitle}-activebetslips`,
                )
                var newBets = merge(currentBets, betslip)
                await allbetSlipsCache.setKey(`${cacheTitle}-activebetslips`, newBets)
            }
            await allbetSlipsCache.save(true)
            await addNewBet(message, betslip, interactionEph) //! Add bet to active bet list in DB [User will receive a response within this function]
            await sortBalance(message, betslip.userid, betslip.amount, 'sub') //! Subtract users bet amount from their balance
            return
        }
        if (
            (message.content.toLowerCase() === 'no' &&
                message.author.id === userId) ||
            (message.content.toLowerCase() === 'cancel' &&
                message.author.id === userId)
        ) {
            collector.stop()
            await message.reply('Bet Cancelled!')
            return
        }
    })
    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            message.reply(
                'Bet Cancelled! You did not confirm your bet in time [60 seconds].',
            )
        }
    })
    //? 60 Second Timer to confirm bet
    setTimeout(() => {
        collector.stop('time')
    }, 60000)
}
