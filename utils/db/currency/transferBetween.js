import { db } from '#db'
import { embedReply, CURRENCY } from '#config'
import { validateUser } from '#utilValidate/validateExistingUser'

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
	interactionEph,
) {
	let newUserBal
	let newTargetUserBal

	const isRegistered = await validateUser(
		interaction,
		userid,
		true,
	)
	if (!isRegistered) return

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
	}).then(() => {
		const isSilent = !!interactionEph
		const embObj = {
			title: `:moneybag: Credit Transfer :moneybag:`,
			description: `You have successfully transferred **$${transferAmount}** to <@${targetUserId}>\nYour balance is now: **$${newUserBal}**`,
			color: `GREEN`,
			target: `reply`,
			silent: isSilent,
		}
		embedReply(interaction, embObj)
	})
}
