import { MessageEmbed } from 'discord.js'
import { accounting } from '#config'

/**
 * @module confirmBetEmbed
 *  Return users input from bet placement in an embed response for them to confirm. See: utils\cmd_res\confirmBet.js
 * @param {object} message - Discord message object
 * @param {object} betslip - The details of the users bet
 * @param {boolean} interactionEph - Whether the response should be visible to the user or not [slash cmd]
 */
export function confirmBetEmbed(message, betslip, interactionEph) {
    var customerFooter =
        'Please Note: If you do not confirm your bet within 60 seconds, it will be cancelled.'
    var format = accounting.format
    var amount = format(betslip.amount)
    var profit = format(betslip.profit)
    var payout = format(betslip.payout)
    const confirmembed = new MessageEmbed()
        .setColor('#ffd600')
        .setTitle(':receipt: Bet Pending Confirmation')
        .setDescription(
            `Please confirm your bet by typing: __***confirm,***__ / __***yes***__ / __***y***__
            To cancel setting up this bet, type: __***cancel***__ / __***no***__ / __***n***__
                    
            **__Bet Details:__**
            
            Team: **${betslip.teamid}** | Amount: \`$${amount}\` 
            Profit: \`$${profit}\` | Payout: \`$${payout}\``,
        )
        .setTimestamp()
        .setThumbnail(`${process.env.sportLogoNBA}`)
        .setFooter({ text: customerFooter })
    if (interactionEph) {
        message.reply({ embeds: [confirmembed], ephemeral: true })
    } else if (!interactionEph) {
        message.reply({ embeds: [confirmembed] })
    }
}
