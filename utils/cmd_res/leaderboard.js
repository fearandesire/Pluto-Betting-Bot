import { container } from '@sapphire/pieces'
import { db } from '#db'

export function leaderboard(message) {
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

            console.log(userBalance)
            await message.reply(userBalance)
        })
}
