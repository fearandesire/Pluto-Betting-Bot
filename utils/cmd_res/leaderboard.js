import { embedReply } from '#config'
import { db } from '#db'
import { container } from '@sapphire/pieces'

/**
 * Retrieve the data from the currency table in the DB - sort by the highest values to the lowest.
 * @param {Message} message - The Discord message object
 * @returns {object} - Returns an embed containing the leaderboard information with user tags and their balances.
 */

export async function leaderboard(message) {
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
				footer: `Sorted by highest credits balance | Pluto - Developed by Fenix#7559`,
				target: `reply`,
			}
			await embedReply(message, embObj)
		})
}
