import { QuickError } from '#config'
import { hasActiveBets } from '#utilValidate/hasActiveBets'
import { listMyBets } from '#utilDB/listMyBets'

/**
 * Check in local cache for list of user bets. If there is no data for the user stored in cache, then retrieve the bets for the user via the activebets table in the databse.
 * @param {object} message - The Discord message object
 * @param {integer} userId - The Discord ID of the user
 * @return {object} Return an embed object of the current bets for the user.
 */

export async function checkBetsCache(message, userId, interactionEph) {
	const user = userId
	// ? Validate if user has any active bets
	await hasActiveBets(user).then(async (data) => {
		if (data.length > 0) {
			await listMyBets(user, message)
			return true
		}
		QuickError(message, 'You have no active bets', interactionEph)
	})
}
