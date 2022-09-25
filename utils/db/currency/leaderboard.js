import { container } from '@sapphire/pieces'
import { db } from '#db'
import { embedReply } from '#config'

/**
 * Retrieve the data from the currency table in the DB - sort by the highest values to the lowest.
 * @param {message} message - The Discord message object
 * @param {boolean} interactionEph - Whether the interaction is ephemeral or not (silent response)
 * @returns {object} - Returns an embed containing the leaderboard information with user tags and their balances.
 */

export async function leaderboard(message, interactionEph) {
	container.memory_balance = {}
	container.memory_balance.leaderboard = []
	return db
		.map(
			`SELECT userid,balance FROM currency ORDER BY balance DESC NULLS LAST`,
			['123'],
			(row) => {
				container.userid = row.userid
				container.balance = row.balance

				var leaderEntry = `<@${container.userid}>: ${container.balance}`

				container.memory_balance = container.memory_balance || {}
				container.memory_balance.leaderboard =
					container.memory_balance.leaderboard || []

				container.memory_balance.leaderboard.push(leaderEntry)
			},
		)
		.then(async function handleResp() {
			var userBalance = container.memory_balance.leaderboard.join('\n')
			const embObj = {
				title: `Betting Leaderboard`,
				description: userBalance,
				color: `#ffff00`,
				footer: `Sorted by highest dollars balance | Pluto - Developed by Fenix#7559`,
				target: `reply`,
				silent: interactionEph,
			}
			await embedReply(message, embObj, true)
			return
		})
}
