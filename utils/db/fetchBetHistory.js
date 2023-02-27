import { QuickError, _, accounting, BETSLIPS } from '#config'

import { db } from '#db'
import { embedReply } from '#embed'

/**
 * Fetch history of a users bets from the db table in the DB.
 * @param {object} message - The Discord Object message object
 * @param {integer} userid - The user id of the user who's bet history is being requested.
 * @return {object} - Embed object of user bet history
 */

export async function fetchBetHistory(message, userid, interactionEph) {
    let entries
    let wonCount = 0
    let lostCount = 0
    let betHistory = []
    db.tx('fetchBetHistory', async (t) => {
        const findings = await t.manyOrNone(
            `SELECT * FROM "${BETSLIPS}" WHERE userid = $1 ORDER BY dateofbet`,
            [userid],
        )
        if (!findings || _.isEmpty(findings)) {
            QuickError(
                message,
                `You have no betting history to view. Try placing a bet first!`,
            )
            return false
        }
        //# Count # of entries
        if (findings) {
            entries = Object.keys(findings).length
            for (let i = 0; i < findings.length; i++) {
                var format = accounting.format
                var amount = format(findings[i].amount)
                var profit = format(findings[i].profit)
                var payout = format(findings[i].payout)
                if (findings[i].betresult === `won`) {
                    wonCount++
                    await betHistory.push({
                        name: `${findings[i].dateofbet} :white_check_mark: `,
                        value: `**Team:** ${findings[i].teamid}\n**Bet Amount:**\`${amount}\`\n:moneybag: **Profit:** \`$${profit}\`\n:moneybag: **Payout:** \`$${payout}\``,
                        inline: true,
                    })
                } else if (findings[i].betresult === 'lost') {
                    lostCount++
                    await betHistory.push({
                        name: `:x: ${findings[i].dateofbet}`,
                        value: `**Team:** ${findings[i].teamid}\n**Bet Amount:** \`$${amount}\`\n:pensive: **Lost Bet, no payout.**`,
                        inline: true,
                    })
                }
            }
        }
    })
        .then(async function historyEmbed(resp) {
            if (resp === false) {
                return
            }
            var userName = message?.author?.username || message?.user?.username
            let embedcontent = {
                title: `${userName}'s Bet History`,
                color: '#00FF00',
                description: `Total Bets: \`${entries}\` | Won: \`${wonCount}\` | Lost: \`${lostCount}\``,
                fields: betHistory,
            }
            await embedReply(message, embedcontent, interactionEph)
        })
        .catch((error) => {
            console.log(error)
            return
        })
}
