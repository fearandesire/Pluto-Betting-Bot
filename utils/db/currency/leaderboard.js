import Promise from 'bluebird'
import { SapDiscClient } from '#main'
import { embedReply, container } from '#config'
import { reqLeaderboard } from './reqLeaderboard.js'

/**
 * Retrieve the data from the currency/profile table in the DB - sort by the highest values to the lowest.
 * @param {message} interaction - The Discord interaction object
 * @returns {object} - Returns an embed containing the leaderboard information with user tags and their balances.
 */

let memberCache = container.leaderboardCache
memberCache = new Map()

export async function leaderboard(interaction) {
	const lb = await reqLeaderboard()
	const server = await SapDiscClient.guilds.cache.get(
		`${process.env.server_ID}`,
	)
	await server.members.fetch()

	const lbArray = []
	let usersIndex

	for (let i = 0; i < lb.length; i += 1) {
		const lbUserId = lb[i].userid
		const lbUserBal = lb[i].balance

		if (lbUserId === interaction?.user?.id) {
			usersIndex = i + 1
		}

		if (!memberCache.has(lbUserId)) {
			const member =
				server.members.cache.get(lbUserId) || null

			if (member) {
				memberCache.set(lbUserId, member)
			}
		}

		const mappedUserCache =
			memberCache.get(lbUserId) || null
		const formatId =
			mappedUserCache?.user || `<@${lbUserId}>`
		const humanIndex = i + 1
		const lbEntry = `**${humanIndex}.** ${formatId}: ${lbUserBal}`
		lbArray.push(lbEntry)
	}

	const lbString = lbArray.join('\n')
	const lbLength = lbString.length

	if (lbLength === 0) {
		return false
	}

	const pageSize = 4096
	const pages = Math.ceil(lbLength / pageSize)

	await Promise.each(
		Array.from({ length: pages }),
		async (_, indx) => {
			const start = indx * pageSize
			const end = start + pageSize
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

			await embedReply(interaction, embObj, true)
		},
	)

	return true
}
