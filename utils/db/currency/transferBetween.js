import discord from 'discord.js'
import accounting from 'accounting'
import { db } from '#db'
import { embedReply, CURRENCY } from '#config'
import { validateUser } from '#utilValidate/validateExistingUser'
import { SapDiscClient } from '#main'
import embedColors from '../../../lib/colorsConfig.js'

const { EmbedBuilder } = discord

/**
 * Transfer money between two users
 * @param {object} interaction - The Discord Message Object
 * @param {integer} userId - The ID of the user
 * @param {integer} targetId - The ID of the target user
 * @param {integer} transferAmount - The amount of money to transfer
 */

export async function transferTo(
	interaction,
	userid,
	targetUserId,
	amountBeingSent,
) {
	let newUserBal
	let newTargetUserBal

	const isRegistered = await validateUser(
		interaction,
		userid,
		true,
	)
	if (!isRegistered) return
	let formattedAmount
	const transferAmount = Number(amountBeingSent)
	db.tx(`transferTo`, async (t) => {
		const getUserBal = await t.oneOrNone(
			`SELECT balance FROM "${CURRENCY}" WHERE userid = $1`,
			[userid],
		)
		if (
			!getUserBal ||
			Number(getUserBal.balance) <
				Number(transferAmount)
		) {
			return interaction.reply(
				`You don't have enough money to transfer.`,
			)
		}
		const getTargetUserBal = await t.oneOrNone(
			`SELECT balance FROM "${CURRENCY}" WHERE userid = $1`,
			[targetUserId],
		)
		newTargetUserBal =
			parseFloat(transferAmount) +
			parseFloat(getTargetUserBal.balance)
		newUserBal =
			parseFloat(getUserBal.balance) -
			parseFloat(transferAmount)
		// ? Update User Balance
		await t.oneOrNone(
			`UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2`,
			[newUserBal, userid],
		)
		// ? Update Target User Balance
		await t.oneOrNone(
			`UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2`,
			[newTargetUserBal, targetUserId],
		)
		formattedAmount = accounting.format(transferAmount)
	}).then(async () => {
		const embObj = {
			title: `:moneybag: Credit Transfer :moneybag:`,
			description: `You have successfully transferred **$${formattedAmount}** to <@${targetUserId}>\nYour balance is now: **$${newUserBal}**`,
			color: embedColors.PlutoBrightGreen,
			target: `reply`,
		}

		await embedReply(interaction, embObj)

		// ? Notify the user
		const userEmb = new EmbedBuilder()
			.setTitle(embObj.title)
			.setDescription(
				`${interaction.user.tag} has transferred **${formattedAmount}** to you`,
			)
			.setColor(embObj.color)
		await SapDiscClient.users.send(targetUserId, {
			embeds: [userEmb],
		})
	})
}
