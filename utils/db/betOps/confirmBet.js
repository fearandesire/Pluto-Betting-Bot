import { Log, embedReply } from '#config'

import { AssignBetID } from '#botUtil/AssignIDs'
import { addNewBet } from '#utilBetOps/addNewBet'
import { isBetIdExisting } from '../validation/isBetIdExisting.js'
import { pendingBet } from '../validation/pendingBet.js'
import { confirmBetEmbed as pleaseConfirmEmbed } from '../../bot_res/embeds/confirmBetEmbed.js'
import { setupBetLog } from '#winstonLogger'
import { sortBalance } from '#utilCurrency/sortBalance'
import stringifyObject from 'stringify-object'

/**
 * @module confirmBet -
 * ⁡⁣⁣⁢Creates a message listener & collection for the user to confirm their bet. ⁡⁣⁣⁢The listener will be active for 60 seconds.⁡
 *⁡⁣⁣⁢ We want to timeout bets that aren't confirmed so we don't have any infinite hangups.⁡
 * @param {obj} message - The message object - contains the user info from Discord & allows us to reply to the user.
 * @param {obj} betslip - The bet information from the user input that we will have them confirm. Additionally, we tack on the matchid, and assign a betid to the bet.
 * @param {boolean} interactionEph - Whether the response should be visible to the user or not [slash cmd]
 * @returns - If the user confirms the bet, pushes bet to DB with {@link addNewBet}
 * If the user does not confirm their bet in time, we inform them of such and end the event.
 */

export async function confirmBet(message, betslip, userId, interactionEph) {
    //& Sending Embed w/ bet details for the user to confirm bet
    await pleaseConfirmEmbed(message, betslip, interactionEph)
    //? Assigning a filter for the message collector to listen for. The colllection will identify the user by their ID
    //# for some reason, this wont work. Assigned a different check for the ID instead[ msgIsFromUser ]
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
        //# Var for checking if the msg received is from the user who placed the bet
        let msgIsFromUser
        msgIsFromUser = message.author.id === userId
        var acceptableAnswers = ['confirm', 'yes', 'y']
        if (
            acceptableAnswers.includes(message.content.toLowerCase()) &&
            msgIsFromUser
        ) {
            collector.stop()
            //# delete from pending
            await new pendingBet().deletePending(userId)
            var betId = await AssignBetID()
            var validateID = await isBetIdExisting(betId)
            Log.Green(
                `Bet ID ${validateID} is unique and has been assigned to user: ${userId}.`,
            )
            betslip.betid = validateID

            setupBetLog.info(
                `Betslip confirmed for ${userId}\n${stringifyObject(betslip)}`,
            )
            await addNewBet(message, betslip, interactionEph) //! Add bet to active bet list in DB [User will receive a response within this function]
            await sortBalance(message, betslip.userid, betslip.amount, 'sub') //! Subtract users bet amount from their balance
            return
        }
        var declineAnswer = [`no`, `n`, `cancel`]
        if (
            declineAnswer.includes(message.content.toLowerCase()) &&
            msgIsFromUser
        ) {
            collector.stop()
            setupBetLog.info(`Betslip cancelled for ${userId}`)
            //# delete from pending
            await new pendingBet().deletePending(userId)
            var embObj = {
                title: `:x: Bet Cancellation`,
                description: `Your ${betslip.amount} bet on the ${betslip.teamid} has been cancelled.`,
                color: `#191919`,
                isSilent: true,
            }
            await embedReply(message, embObj, true)
            return
        }
    })
    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            var embObj = {
                title: `:x: Bet Cancelled`,
                description: `Your bet on the ${betslip.teamid} has been cancelled.`,
                color: `#191919`,
                followUp: true,
            }
            //# delete from pending
            await new pendingBet().deletePending(userId)
            await embedReply(message, embObj, true)
            return
        }
    })
    //& 60 Second Timer to confirm bet
    setTimeout(() => {
        collector.stop('time')
    }, 60000)
}
