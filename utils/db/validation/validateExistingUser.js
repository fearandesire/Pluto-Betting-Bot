import { QuickError } from '#embed'
import { isExistingUser } from '#utilValidate/isExistingUser'
import PendingBetHandler from './pendingBet.js'

/**
 * @module validateExistingUser -
 * Validates if a user is registered with the bot (via their userid in the profiles table)
 * @param {obj} interaction - Discord Interaction Object
 * @param {integer} userid - The user's ID
 * @returns {boolean} True if the user is registered, throws error otherwise
 */
export async function validateUser(
	interaction,
	userid,
	betProcess,
) {
	await isExistingUser(userid).then(async (data) => {
		if (!data) {
			let errorMsg
			const currentUser = interaction.user.id
			if (currentUser === userid) {
				errorMsg = `It looks like you aren't in the system yet. Use the \`/register\` slash command to instantly register.`
			} else {
				errorMsg = `User <@${userid}> is not registered with Pluto.`
			}
			if (betProcess) {
				// # delete from pending
				await PendingBetHandler.deletePending(
					userid,
				)
			}
			await QuickError(interaction, errorMsg, true)
			return false
		}
		return true
	})
}
