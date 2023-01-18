import { Log, embedReply } from '#config'
import { AssignBetID } from '#botUtil/AssignIDs'
import { addNewBet } from '#utilBetOps/addNewBet'
import { isBetIdExisting } from '../validation/isBetIdExisting.js'
import { pendingBet } from '../validation/pendingBet.js'
import { setupBetLog } from '#winstonLogger'
import { sortBalance } from '#utilCurrency/sortBalance'
import stringifyObject from 'stringify-object'
import { MessageEmbed } from 'discord.js'
import { accounting } from '#config'
import { SapDiscClient } from '#main'
import { findEmoji } from '#botUtil/findEmoji'
/**
 * @module confirmBet -
 * Create's a message listener for the user to accept, or cancel their pending bet via pressing/clicking reactions.
 * @param {object} interaction - The message object - contains the user info from Discord & allows us to reply to the user.
 * @param {object} betslip - The details of the users bet
 */

export async function confirmBet(interaction, betslip, userId) {
    // ? Sending Embed w/ bet details for the user to confirm bet
    var customerFooter =
        'Please Note: If you do not confirm your bet within 60 seconds, it will be cancelled.'
    var format = accounting.format
    var amount = format(betslip.amount)
    var profit = format(betslip.profit)
    var payout = format(betslip.payout)
    // ? Get the last word of the team name
    var teamName = betslip.teamid.split(' ').pop()
    let teamEmoji = (await findEmoji(teamName)) || ''
    betslip.teamEmoji = teamEmoji || ''
    let confirmembed = new MessageEmbed()
        .setColor('#ffd600')
        .setTitle(':receipt: Bet Pending Confirmation')
        .setDescription(
            `Please confirm your bet by pressing the :white_check_mark: reaction below.
            To cancel, press the :x: reaction below.
                
        **__Bet Details:__**
        
        Team: **${betslip.teamid}** | Amount: \`$${amount}\` 
        Profit: \`$${profit}\` | Payout: \`$${payout}\``,
        )
        .setTimestamp()
        .setThumbnail(`${process.env.sportLogo}`)
        .setFooter({ text: customerFooter })

    // ? Preview the embed to the user
    let previewEmbed = await interaction.followUp({
        content: `<@${userId}>`,
        embeds: [confirmembed],
        ephemeral: true,
    })
    await previewEmbed.react('✅')
    await previewEmbed.react('❌')
    // ? Create reaction collector
    const filter = (reaction, user) => {
        return ['✅', '❌'].includes(reaction.emoji.name) && user.id === userId
    }
    const collector = previewEmbed.createReactionCollector({
        filter,
        time: 60000,
    })
    collector.on('collect', async (reaction, user) => {
        if (reaction.emoji.name === '✅' && user.id === userId) {
            //& User confirmed bet, add to DB
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
            await addNewBet(interaction, betslip) //! Add bet to active bet list in DB [User will receive a response within this function]
            await sortBalance(interaction, betslip.userid, betslip.amount, 'sub') //! Subtract users bet amount from their balance
        } else if (reaction.emoji.name === '❌' && user.id === userId) {
            collector.stop()
            //& User cancelled bet, delete from pending
            setupBetLog.info(`Betslip cancelled for ${userId}`)
            //# delete from pending
            await new pendingBet().deletePending(userId)
            var embObj = {
                title: `:x: Bet Cancellation`,
                description: `Your \`$${amount}\` bet on the ${betslip.teamid} has been cancelled.`,
                color: `#191919`,
                followUp: true,
            }
            await embedReply(interaction, embObj, true)
            return
        } else {
            return
        }
    })
    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            //# delete from pending
            await new pendingBet().deletePending(userId)
            var embObj = {
                title: `:x: Bet Cancellation`,
                description: `<@${userId}>, your \`$${amount}\` bet on the ${betslip.teamid}  has been cancelled since you didn't respond in time..`,
                color: `#191919`,
                followUp: true,
            }
            await embedReply(interaction, embObj, true)
            return
        } else {
            return
        }
    })
}
