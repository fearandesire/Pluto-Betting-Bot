import { MessageEmbed } from 'discord.js'

/**
 * @module confirmBetEmbed
 *  Return users input from bet placement in an embed response for them to confirm. See: utils\cmd_res\confirmBet.js
 * @param {object} message - Discord message object
 * @param {object} betslip - The details of the users bet
 * @param {boolean} interactionEph - Whether the response should be visible to the user or not [slash cmd]
 */
export function confirmBetEmbed(message, betslip, interactionEph) {
    var customerFooter =
        'PLEASE NOTE: YOUR BET IS NOT CONFIRMED YET! | Acceptable Inputs include `yes`, `confirm` or `no`, `cancel`'
    var isSilent = interactionEph ? true : false
    const confirmembed = new MessageEmbed()
        .setColor('#0099ff')
        .setTitle('Bet Slip Confirmation')
        .setDescription(
            `Below, you will find your bet slip. Please confirm your bet slip by typing **yes** or **no**`,
        )
        .addFields(
            {
                name: `Bet Amount: `,
                value: `$${betslip.amount}`,
                inline: true,
            },
            {
                name: `Team: `,
                value: `${betslip.teamid}`,
                inline: true,
            },
            {
                name: `Potential Payout: `,
                value: `$${betslip.payout}`,
                inline: false,
            },
            {
                name: `Potential Profit: `,
                value: `$${betslip.profit}`,
                inline: false,
            },
        )
        .setTimestamp()
        .setFooter({ text: customerFooter })
    if (interactionEph) {
        message.reply({ embeds: [confirmembed], ephemeral: true })
    } else if (!interactionEph) {
        message.reply({ embeds: [confirmembed] })
    }
}
