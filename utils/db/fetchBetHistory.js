import { QuickError } from '#config'
import { db } from '#db'
import { embedReply } from '#embed'

/**
 * Fetch history of a users bets from the betslips table in the DB.
 * @param {object} message - The Discord Object message object
 * @param {integer} userid - The user id of the user who's bet history is being requested.
 * @return {object} - Embed object of user bet history
 */
export async function fetchBetHistory(message, userid, interactionEph) {
    let betHistory = []
    db.tx('fetchBetHistory', async (t) => {
        const findings = await t.manyOrNone(
            'SELECT * FROM betslips WHERE userid = $1 ORDER BY dateofbet',
            [userid],
        )
        if (!findings) {
            QuickError(message, `You have no betting history to view.`)
        }
        if (findings) {
            for (let i = 0; i < findings.length; i++) {
                if (findings[i].betresult === `won`) {
                    await betHistory.push({
                        name: `${findings[i].dateofbet}`,
                        value: `**Team:** ${findings[i].teamid}\n**Bet Amount:** $${findings[i].amount}\n:moneybag: **Profit:** $${findings[i].profit}\n:moneybag: **Payout:** $${findings[i].payout}`,
                        inline: true,
                    })
                } else if (findings[i].betresult === 'lost') {
                    await betHistory.push({
                        name: `${findings[i].dateofbet}`,
                        value: `**Team:** ${findings[i].teamid}\n**Bet Amount:** $${findings[i].amount}\n:pensive: **Lost Bet, no payout.**`,
                        inline: true,
                    })
                }
            }
        }
    })
        .then(async function historyEmbed() {
            var userName = message?.author?.username || message?.user?.username
            let embedcontent = {
                title: `${userName}'s Bet History`,
                color: '#00FF00',
                fields: betHistory,
            }
            await embedReply(message, embedcontent, interactionEph)
        })
        .catch((error) => {
            console.log(error)
            return
        })
}
