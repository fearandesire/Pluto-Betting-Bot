import { MessageEmbed } from 'discord.js'
import { accounting } from '#config'

/**
 * @module confirmBetEmbed
 *  Return users input from bet placement in an embed response for them to confirm. See: utils\cmd_res\confirmBet.js
 * @param {object} message - Discord message object
 * @param {object} betslip - The details of the users bet
 * @param {boolean} interactionEph - Whether the response should be visible to the user or not [slash cmd]
 */
export function confirmBetEmbed(message, betslip) {
    //    message.reply({ embeds: [confirmembed], ephemeral: true })
}
