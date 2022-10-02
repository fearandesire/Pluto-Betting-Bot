import { AssignBetID } from '#botUtil/AssignIDs'
import { addNewBet } from '#utilBetOps/addNewBet'
import { embedReply } from '#config'
import flatcache from 'flat-cache'
import merge from 'deepmerge'
import { confirmBetEmbed as pleaseConfirmEmbed } from '../../bot_res/embeds/confirmBetEmbed.js'
import { setupBetLog } from '#winstonLogger'
import { sortBalance } from '#utilCurrency/sortBalance'
import stringifyObject from 'stringify-object'

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
    //? Sending Embed w/ bet details for the user to confirm bet
    await pleaseConfirmEmbed(message, betslip, interactionEph)
    //? Assigning a filter for the message collector to listen for. The colllection will identify the user by their ID
    //# for some reason, this wont work. Assigned a manaul check for the ID instead.
    const filter = (user) => {
        return user.id === userId
    }
    setupBetLog.info(`Started bet confirmation timer for ${userId}`)
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
            collector.stop()
            var setBetID = AssignBetID()
            betslip.betid = setBetID
            // Log.Green(
            //     `[confirmBet.js] ${
            //         betslip.userid
            //     } confirmed a bet!\n Bet Slip:\n ${JSON.stringify(betslip)}`,
            // )

            setupBetLog.info(
                `Betslip confirmed for ${userId}\n${stringifyObject(betslip)}`,
            )
            //? If user already has collected their list of bets via 'listBets', we need to allow them to retrieve a new list since they are adding to it.
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
            setupBetLog.info(`Betslip cancelled for ${userId}`)
            var embObj = {
                title: `Bet Cancellation`,
                description: `Your bet has been cancelled. Your balance has not been affected.`,
                color: `#ffff00`,
                isSilent: true,
                target: `reply`,
            }
            await embedReply(message, embObj, true)
            return
        }
    })
    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            setupBetLog.info(`Betslip timed out for ${userId}`)
            return
        }
    })
    //& 60 Second Timer to confirm bet
    setTimeout(() => {
        collector.stop('time')
    }, 60000)
}
