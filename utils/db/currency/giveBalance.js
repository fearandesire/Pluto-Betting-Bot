import db from '@pluto-db'
import {
	embedReply,
	CURRENCY,
	formatCurrency,
} from '@pluto-core-config'
import { SapDiscClient } from '@pluto-core'
import { Log } from '@pluto-internal-logger'
import { isInServer } from '../../bot_res/isInServer.js'
import embedColors from '../../../lib/colorsConfig.js'
import { convertColor } from '../../bot_res/embeds/embedReply.js'

/**
 * @module giveBalance - Give money / dollars to a specified user
 * @param {integer} interaction - The Discord Message Object
 * @param {integer} targetUserId - The user's Discord ID
 * @param {integer} transferammount - How much to give the user
 */

export async function giveBalance(
	interaction,
	targetUserId,
	transferammount,
	interactionEph,
) {
	Log.Yellow(`[transfer.js] Running transfer!`)
	const embColor = await convertColor(
		embedColors.PlutoBrightGreen,
	)
	db.tx('processClaim-Transaction', async (t) => {
		const findUser = await t.oneOrNone(
			`SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
			[targetUserId],
		)
		const currentBalance = findUser.balance
		const updatebalance =
			Number(currentBalance) + Number(transferammount)
		const isSilent = !!interactionEph
		const embObj = {
			title: `:moneybag: Sent Money`,
			description: `You have sent ${formatCurrency(
				transferammount,
			)} to <@${targetUserId}>!`,
			color: `${embedColors.PlutoBrightGreen}`,
			silent: isSilent,
			target: `reply`,
		}
		await embedReply(interaction, embObj)
		// # DM the user they received money
		const verifyUser = await isInServer(targetUserId)
		if (verifyUser) {
			const receivedMoneyEmb = {
				title: `:moneybag: Received Money`,
				description: `You have received $${transferammount} from <@${interaction.user.id}>!`,
				color: `${embColor}`,
				footer: '',
			}

			await SapDiscClient.users
				.fetch(`${targetUserId}`)
				.then(async (user) => {
					if (!user) {
						Log.Error(
							`Failed to send DM to user ${targetUserId} is no longer in the server.`,
						)
						return
					}
					await user.send({
						embeds: [receivedMoneyEmb],
					})
				})
		}
		return t.any(
			`UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2 RETURNING *`,
			[updatebalance, targetUserId],
		)
	})
}
