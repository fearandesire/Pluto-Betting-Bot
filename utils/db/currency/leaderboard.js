import { SapDiscClient } from '#main'
import { embedReply, container } from '#config'
import { reqLeaderboard } from './reqLeaderboard.js'

/**
 * Retrieve the data from the currency/profile table in the DB - sort by the highest values to the lowest.
 * @param {message} message - The Discord message object
 * @param {boolean} interactionEph - Whether the interaction is ephemeral or not (silent response)
 * @returns {object} - Returns an embed containing the leaderboard information with user tags and their balances.
 */
let memberCache = container.leaderboardCache
memberCache = new Map()

export async function leaderboard(message) {
	await reqLeaderboard().then(async (lb) => {
		const server = await SapDiscClient.guilds.cache.get(
			`${process.env.server_ID}`,
		)
		await server.members.fetch().then(async () => {
			const lbArray = []
			let usersIndex
			for (let i = 0; i < lb.length; i++) {
				const lbUserId = lb[i].userid
				const lbUserBal = lb[i].balance
				if (lbUserId === message?.user?.id) {
					usersIndex = i + 1
				}
				if (!memberCache.has(lbUserId)) {
					const member =
						server.members.cache.get(
							lbUserId,
						) || null
					if (member)
						memberCache.set(lbUserId, member)
				}
				const mappedUserCache =
					memberCache.get(lbUserId) || null
				const formatId =
					mappedUserCache?.user ||
					`<@${lbUserId}>`
				const humanIndex = i + 1
				const lbEntry = `**${humanIndex}.** ${formatId}: ${lbUserBal}`
				lbArray.push(lbEntry)
			}
			const lbString = lbArray.join('\n')
			const lbLength = lbString.length
			if (lbLength === 0) return false

			const pages = Math.ceil(lbLength / 4096)
			for (let indx = 0; indx < pages; indx += 1) {
				const start = indx * 4096
				const end = start + 4096
				const page = indx + 1
				const pageData = lbString.slice(start, end)
				const embObj = {
					title: `Betting Leaderboard [Page ${page}]`,
					description: pageData,
					color: `#ffff00`,
					footer: `You are currently #${usersIndex} on the Leaderboard! | Page ${page}`,
					target: `reply`,
					silent: true,
					followUp: true,
				}
				await embedReply(message, embObj, true)
			}
		})
	})
}
