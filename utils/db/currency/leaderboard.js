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

export async function leaderboard(message, interactionEph) {
    await reqLeaderboard().then(async (lb) => {
        const server = await SapDiscClient.guilds.cache.get(
            `${process.env.server_ID}`,
        )
        await server.members.fetch().then(async (memberList) => {
            let lbArray = []
            let usersIndex
            let usersBal
            for (var i = 0; i < lb.length; i++) {
                var lbUserId = lb[i].userid
                var lbUserBal = lb[i].balance
                if (lbUserId == message?.user?.id) {
                    usersIndex = i + 1
                    usersBal = lb[i].balance
                }
                if (!memberCache.has(lbUserId)) {
                    let member = server.members.cache.get(lbUserId)
                    if (!member) member = await server.members.fetch(lbUserId)
                    memberCache.set(lbUserId, member)
                }
                let mappedUserCache = memberCache.get(lbUserId)
                var formatId = mappedUserCache.user || mappedUserCache.user.tag
                var humanIndex = i + 1
                var lbEntry = `**${humanIndex}.** ${formatId}: ${lbUserBal}`
                lbArray.push(lbEntry)
            }
            var lbString = lbArray.join('\n')
            var lbLength = lbString.length
            console.log(`Array Length: ${lbLength}`)
            var pages = Math.ceil(lbLength / 4096)
            for (var indx = 0; indx < pages; indx++) {
                var start = indx * 4096
                var end = start + 4096
                var page = indx + 1
                var pageData = lbString.slice(start, end)
                var embObj = {
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
