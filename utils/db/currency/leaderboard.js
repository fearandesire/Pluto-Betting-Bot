import { embedReply, _ } from '#config'
import { db } from '#db'
import { container } from '@sapphire/pieces'
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

                var leaderEntry = `<@${container.userid}>: $${container.balance}`

                container.memory_balance = container.memory_balance || {}
                container.memory_balance.leaderboard =
                    container.memory_balance.leaderboard || []

                container.memory_balance.leaderboard.push(leaderEntry)
            },
        )
        .then(async function handleResp() {
            //# find the position of the user in the leaderboard via _.findKey on the array
            var userId = message?.user?.id
            var userPosition = _.findKey(
                container.memory_balance.leaderboard,
                function (o) {
                    return o.includes(userId)
                },
            )
            //# add 1 to the position to make it 'accurate', since arrays start at 0
            userPosition = Number(userPosition) + 1
            //# prefix each entry with the position in the leaderboard
            var lbArr = container.memory_balance.leaderboard
            lbArr = lbArr.map((entry, index) => {
                return `**${index + 1}.** ${entry}`
            })
            //# join the array into a string
            var userBalance = lbArr.join('\n')
            //# Get length of the leaderboard array. If the characters are above 4096, split the array in half and send two different embeds.
            var lbLength = lbArr.toString().length
            console.log(`Array Length: ${lbLength}`)
            if (lbLength > 4096) {
                var lbArr1 = lbArr.slice(0, lbArr.length / 2)
                var lbArr2 = lbArr.slice(lbArr.length / 2, lbArr.length)
                var half1Data = lbArr1.join('\n')
                var half2Data = lbArr2.join('\n')
                var firstHalf = {
                    title: `Betting Leaderboard [Page 1]`,
                    description: half1Data,
                    color: `#ffff00`,
                    footer: `You are currently #${userPosition} on the Leaderboard! | Page 1`,
                    target: `reply`,
                    silent: interactionEph,
                    followUp: true,
                }
                var secondHalf = {
                    title: `Betting Leaderboard [Page 2]`,
                    description: half2Data,
                    color: `#ffff00`,
                    footer: `You are currently #${userPosition} on the Leaderboard! | Page 2`,
                    target: `reply`,
                    silent: interactionEph,
                    followUp: true,
                }
                await embedReply(message, firstHalf, true)
                await embedReply(message, secondHalf, true)
            }
            const embObj = {
                title: `Betting Leaderboard`,
                description: userBalance,
                color: `#ffff00`,
                footer: `You are currently #${userPosition} on the Leaderboard!`,
                target: `reply`,
                silent: interactionEph,
            }
            await embedReply(message, embObj, true)
            return
        })
}
