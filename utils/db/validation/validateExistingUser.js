import { QuickError } from '#embed'
import { isExistingUser } from '#utilValidate/isExistingUser'
import { pendingBet } from './pendingBet.js'

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
				errorMsg = `You are not registered with Pluto. Please register with the command: \`/register\``
			} else {
				errorMsg = `User <@${userid}> is not registered with Pluto.`
			}
			if (betProcess) {
				// # delete from pending
				await new pendingBet().deletePending(userid)
			}
			await QuickError(interaction, errorMsg, true)
			return false
		} 
			return true
		
	})
}
