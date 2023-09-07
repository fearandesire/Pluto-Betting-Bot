import stringifyObject from 'stringify-object'
import { MessageEmbed } from 'discord.js'
import { Log, accounting } from '#config'
import { AssignBetID } from '#botUtil/AssignIDs'
import { addNewBet } from '#utilBetOps/addNewBet'
import { setupBetLog } from '#winstonLogger'
import { sortBalance } from '#utilCurrency/sortBalance'
import { guildImgURL } from '#embed'
import { isBetIdExisting } from '../validation/isBetIdExisting.js'
import PendingBetHandler from '../validation/pendingBet.js'
import { findEmoji } from '../../bot_res/findEmoji.js'

/**
 * @module confirmBet -
 * Create's a message listener for the user to accept, or cancel their pending bet via pressing/clicking reactions.
 * @param {object} interaction - The message object - contains the user info from Discord & allows us to reply to the user.
 * @param {object} betslip - The details of the users bet
 */

export async function confirmBet(
	interaction,
	betslip,
	userId,
) {
	// ? Sending Embed w/ bet details for the user to confirm bet
	const customerFooter =
		'Please note: you have 60 seconds to confirm your bet.'
	const { format } = accounting
	const amount = format(betslip.amount)
	const profit = format(betslip.profit)
	const payout = format(betslip.payout)
	// ? Get the last word of the team name
	const teamName = betslip.teamid.split(' ').pop()
	const teamEmoji = (await findEmoji(teamName)) || ''
	betslip.teamEmoji = teamEmoji || ''
	const confirmembed = new MessageEmbed()
		.setColor('#ffd600')
		.setTitle(':receipt: Bet Pending')
		.setDescription(
			`:white_check_mark: to confirm  | :x: to cancel\n\n**__Bet Details:__**
        
        Team: **${betslip.teamid}** ${teamEmoji} | Amount: \`$${amount}\` 
        Profit: \`$${profit}\` | Payout: \`$${payout}\``,
		)
		.setTimestamp()
		.setThumbnail(`${guildImgURL(interaction.client)}`)
		.setFooter({ text: customerFooter })

	// ? Preview the embed to the user
	const previewEmbed = await interaction.followUp({
		content: `<@${userId}>`,
		embeds: [confirmembed],
		ephemeral: true,
	})
	await previewEmbed.react('✅')
	await previewEmbed.react('❌')
	// ? Create reaction collector
	const filter = (reaction, user) =>
		['✅', '❌'].includes(reaction.emoji.name) &&
		user.id === userId
	const collector = previewEmbed.createReactionCollector({
		filter,
		time: 60000,
	})
	collector.on('collect', async (reaction, user) => {
		if (
			reaction.emoji.name === '✅' &&
			user.id === userId
		) {
			// & User confirmed bet, add to DB
			collector.stop()
			// # delete from pending
			await PendingBetHandler.deletePending(userId)
			const betId = await AssignBetID()
			const validateID = await isBetIdExisting(betId)
			Log.Green(
				`Bet ID ${validateID} is unique and has been assigned to user: ${userId}.`,
			)
			betslip.betid = validateID

			setupBetLog.info(
				`Betslip confirmed for ${userId}\n${stringifyObject(
					betslip,
				)}`,
			)
			await addNewBet(interaction, betslip) //! Add bet to active bet list in DB [User will receive a response within this function]
			await sortBalance(
				interaction,
				betslip.userid,
				betslip.amount,
				'sub',
			) //! Subtract users bet amount from their balance
		} else if (
			reaction.emoji.name === '❌' &&
			user.id === userId
		) {
			collector.stop()
			// & User cancelled bet, delete from pending
			setupBetLog.info(
				`Betslip cancelled for ${userId}`,
			)
			// # delete from pending
			await PendingBetHandler.deletePending(userId)
			const embCancel = {
				title: `:x: Bet Cancellation`,
				description: `Your \`$${amount}\` bet on the **${betslip.teamid}** has been cancelled.`,
				color: `#191919`,
			}
			// # Edit embed with new info
			await previewEmbed.edit({
				embeds: [
					confirmembed
						.setTitle(embCancel.title)
						.setDescription(
							embCancel.description,
						)
						.setColor(embCancel.color)
						.setFooter({ text: '' })
						.setTimestamp(null),
				],
			})
		}
	})
	collector.on('end', async (collected, reason) => {
		if (reason === 'time') {
			// # delete from pending
			await PendingBetHandler.deletePending(userId)
			const embTimeout = {
				title: `:x: Bet Cancellation`,
				description: `<@${userId}>, your \`$${amount}\` bet on the **${betslip.teamid}**  has been cancelled since you didn't respond in time..`,
				color: `#191919`,
				followUp: true,
			}
			// # Edit embed with new info
			await previewEmbed.edit({
				embeds: [
					confirmembed
						.setTitle(embTimeout.title)
						.setDescription(
							embTimeout.description,
						)
						.setColor(embTimeout.color)
						.setFooter({ text: '' })
						.setTimestamp(null),
				],
			})
		}
	})
}
