import { SapDiscClient } from '#main'
import { embedReply } from '#config'
import { reqLeaderboard } from './reqLeaderboard.js'

/**
 * Retrieve the data from the "NBAcurrency" table in the DB - sort by the highest values to the lowest.
 * @param {message} message - The Discord message object
 * @param {boolean} interactionEph - Whether the interaction is ephemeral or not (silent response)
 * @returns {object} - Returns an embed containing the leaderboard information with user tags and their balances.
 */

export async function leaderboard(message, interactionEph) {
    await reqLeaderboard().then(async (lb) => {
        const server = await SapDiscClient.guilds.cache.get(
            `${process.env.server_ID}`,
        )
        await server.members.fetch().then(async () => {
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

                var membersId = server.members.cache.get(`${lbUserId}`)
                var humanIndex = i + 1
                var lbEntry = `**${humanIndex}.** ${membersId}: ${lbUserBal}`
                lbArray.push(lbEntry)
            }
            lbArray = lbArray.join('\n')
            var lbString = lbArray.toString()
            var lbLength = lbString.length
            console.log(`Array Length: ${lbLength}`)
            if (lbLength > 4096) {
                var lbArr1 = lbString.slice(0, lbArray.length / 2)
                var lbArr2 = lbString.slice(lbArray.length / 2, lbArray.length)
                var half1Data = lbArr1.join('\n')
                var half2Data = lbArr2.join('\n')
                var firstHalf = {
                    title: `Betting Leaderboard [Page 1]`,
                    description: half1Data,
                    color: `#ffff00`,
                    footer: `You are currently #${usersIndex} on the Leaderboard! | Page 1`,
                    target: `reply`,
                    silent: true,
                    followUp: true,
                }
                var secondHalf = {
                    title: `Betting Leaderboard [Page 2]`,
                    description: half2Data,
                    color: `#ffff00`,
                    footer: `You are currently #${usersIndex} on the Leaderboard! | Page 2`,
                    target: `reply`,
                    silent: true,
                    followUp: true,
                }
                await embedReply(message, firstHalf, true)
                await embedReply(message, secondHalf, true)
            }
            const embObj = {
                title: `Betting Leaderboard`,
                description: lbArray,
                color: `#ffff00`,
                footer: `You are currently #${usersIndex} on the Leaderboard!`,
                target: `reply`,
                silent: true,
                followUp: true,
            }
            //await message.reply({ embeds: [embObj] })
            await embedReply(message, embObj, true)
        })
    })
}
