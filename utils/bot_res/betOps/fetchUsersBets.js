import { QuickError } from '#config'
import { hasActiveBets } from '#utilValidate/hasActiveBets'
import { listMyBets } from '#utilDB/listMyBets'

/**
 * Retrieve User Bet Information
 * @param {object} interaction - The Discord interaction object
 * @param {integer} userId - The Discord ID of the user
 * @return {object} Return an embed object of the current bets for the user.
 */

export default async function fetchUsersBets(
	interaction,
	userId,
) {
	const user = userId
	await hasActiveBets(user).then(async (res) => {
		if (res === true) {
			await listMyBets(user, interaction)
		} else {
			await QuickError(
				interaction,
				`You don't have any active bets right now.\nUse the \`/odds\` slash command to place a bet!`,
			)
		}
	})
}
