import accounting from 'accounting'
import _ from 'lodash'
import db from '@pluto-db'
import {
	Log,
	QuickError,
	embedReply,
	CURRENCY,
	helpfooter,
} from '@pluto-core-config'
import { SapDiscClient } from '@pluto-core'
import embedColors from '../../../lib/colorsConfig.js'
import XPHandler from '../../xp/XPHandler.js'

/**
 * @module checkBalance -
 * ⁡⁣⁣⁢⁡⁣⁣⁢Queries the database for the balance of a user via their userid⁡
 * @param {integer} inputuserid - The user's ID
 * @param {obj} interaction - The message object from the Discord.js API
 * @param {boolean} target - This will either be true or false, dependant on whether or not a userid was inputted.
 * If true, the 'inputuserid' will be the target user's id.
 * @references {@link balance.js} - balance.js calls this function to retrieve the balance of a user.
 */

export async function checkbalance(
	inputuserid,
	interaction,
	target,
) {
	const targetName = target?.user?.username
	const targetId = target?.id
	let queryUserOrTarget
	if (target) {
		queryUserOrTarget = targetId
	} else {
		queryUserOrTarget = inputuserid
	}
	db.tx('checkbalance-Transaction', async (t) => {
		// ? Querying database for the balance. Our query results are stored in the 'findings' variable
		const balQuery = await t.oneOrNone(
			`SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
			[queryUserOrTarget],
		)
		// ? Findings will return null (!findings) if the user does not exist in the database
		// ? In this instance, since 'notusercheck' is true; which means we are checking for another user's information. This is relevant for our response message
		if (!balQuery && target) {
			QuickError(
				interaction,
				`This user is not registered with Pluto!`,
			)
			return
		}
		if (!balQuery) {
			// ? Findings is null, meaning the user does not exist in the database.
			Log.BrightBlue(
				`[checkbalance.js] User ${inputuserid} is not in the database, creating user`,
			)
			interaction.reply(
				`I see this is your first time using Pluto, welcome! I've created an account for you and assigned 100 dollars.`,
			)
			return t.any(
				`INSERT INTO "${CURRENCY}" (userid, balance) VALUES ($1, $2) RETURNING *`,
				[inputuserid, '100'],
			) // ? Create user in the database
		}
		const balance = accounting.format(balQuery.balance)
		// ? The user exists in the database
		if (
			(balQuery.userid === inputuserid && !target) ||
			inputuserid === targetId
		) {
			const userAcc = await SapDiscClient.users.fetch(
				inputuserid,
			) // ? Fetch the target user
			// discordName = discordName || 'User'
			// Get avatar URL of user
			const avatarURL = userAcc.avatarURL()
			const xpHandler = new XPHandler(inputuserid)
			const userTier = await xpHandler.getUserTier()
			const { tier, userLevel } = userTier
			const balEmbed = {
				title: `:money_with_wings: ${userAcc.tag}'s Profile`,
				description: `**💰 Balance: \`$${balance}\`**\n**🔰 Level: \`${userLevel}\`**\n**💫 Tier: ${_.upperFirst(
					tier,
				)}**\n\n*View information on levels & tiers via /faq*`,
				color: `${embedColors.PlutoBrightGreen}`,
				footer: 'To view all commands, type /commands',
				thumbnail: avatarURL,
			}
			embedReply(interaction, balEmbed) // ? Sending embed with balance to user
		} else if (balQuery.userid === targetId) {
			const calledBy =
				await SapDiscClient.users.fetch(inputuserid) // ? Fetch user who called the command
			const targetAvatarURL = await target.avatarURL()
			const xpHandler = new XPHandler(inputuserid)
			const userTier = await xpHandler.getUserTier(
				inputuserid,
			)

			const { tier, userLevel } = userTier
			const targetBalEmbd = {
				title: `:money_with_wings: ${targetName}'s Profile`,
				description: `**💰 Balance: \`$${balance}\`**\n**🔰 Level: \`${userLevel}\`**\n**💫 Tier: ${_.upperFirst(
					tier,
				)}**\n*View information on levels & tiers via /faq*\n\n*Requested by ${
					calledBy.nickname
				}*`,
				color: `${embedColors.PlutoBrightGreen}`,
				footer: helpfooter,
				thumbnail: targetAvatarURL,
			}
			embedReply(interaction, targetBalEmbd) // ? Sending embed with balance to user
		}
	})
		// ? Catching connection errors, not database data/table/error errors.
		.catch((error) => {
			Log.Border(
				`[checkbalance.js] Something went wrong...`,
			)
			Log.Error(error)
		})
}
