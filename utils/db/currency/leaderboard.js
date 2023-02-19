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
            let lbArray = []
            let usersIndex
            for (let i = 0; i < lb.length; i++) {
                let lbUserId = lb[i].userid
                let lbUserBal = lb[i].balance
                if (lbUserId == message?.user?.id) {
                    usersIndex = i + 1
                }
                if (!memberCache.has(lbUserId)) {
                    let member = server.members.cache.get(lbUserId) || null
                    if (member) memberCache.set(lbUserId, member)
                }
                let mappedUserCache = memberCache.get(lbUserId) || null
                let formatId = mappedUserCache?.user || `<@${lbUserId}>`
                let humanIndex = i + 1
                let lbEntry = `**${humanIndex}.** ${formatId}: ${lbUserBal}`
                lbArray.push(lbEntry)
            } 
            let lbString = lbArray.join('\n')
            let lbLength = lbString.length
            console.log(`Array Length: ${lbLength}`)
            let pages = Math.ceil(lbLength / 4096)
            for (let indx = 0; indx < pages; indx++) {
                let start = indx * 4096
                let end = start + 4096
                let page = indx + 1
                let pageData = lbString.slice(start, end)
                let embObj = {
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
