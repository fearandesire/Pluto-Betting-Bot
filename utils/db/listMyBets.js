/** @module listMyBets*/

import { accounting, container, embedReply } from '#config'

import { FileRunning } from '#botClasses/FileRunning'
import { Log } from '#LogColor'
import { QuickError } from '#config'
import { db } from '#db'
import stringifyObject from 'stringify-object'

/**
 * @module listMyBets
 * Query the database for all bets placed by the user
 * @param {integer} userid - The user's Discord ID
 * @param {obj} message - The Duscord message object
 */
export function listMyBets(userid, message) {
    container[`listBets-${userid}`] = []
    new FileRunning('listMyBets')
    //? This arrow function used in⁡⁣⁣⁢ 𝙙𝙗⁡⁣⁣⁢.𝙢𝙖𝙥⁡ is to declare what we want to do with ⁡⁢⁣⁣𝙚𝙖𝙘𝙝⁡ row of the query result (see pg-promise db.Map method).

    db.map(
        `SELECT * FROM "betslips" WHERE userid = $1`,
        [userid],
        async (row) => {
            var amount = row.amount
            var teamId = row.teamid
            var betId = row.betid
            var result = row.betresult
            if (
                row == null ||
                row.length == 0 ||
                row.length < 1 ||
                row == undefined
            ) {
                return
            }
            if (result.toLowerCase() == 'pending') {
                Log.Red(`Pending bet found for user ${userid}`)
                Log.Green(
                    `[listMyBets.js] Bets Collected for ${userid}:\n${stringifyObject(
                        row,
                    )}`,
                )
                var format = accounting.format
                amount = format(amount)
                var profit = format(row.profit) ?? `N/A`
                var payout = format(row.payout) ?? `N/A`
                container[`listBets-${userid}`].push(
                    `**•** __Bet #${betId}__
            Team: **${teamId}** | Amount: \`$${amount}\`
            Profit: \`$${profit}\` | Payout: \`$${payout}\``,
                )
            } else {
                Log.Red(`Something went wrong when listing bets for user ${userid}`)
                return
            }
        },
    )
        .then(async function handleResp() {
            await Log.Green(
                `[listMyBets.js] Collected User (${userid}) Bet Information [Memory - Stage 2]:`,
            )
            await Log.BrightBlue(container[`listBets-${userid}`])
            var userName = message?.author?.username
                ? message?.author?.username
                : message?.user?.id
            var isSelf =
                message?.author?.id === userid
                    ? true
                    : message?.user?.id === userid
                    ? true
                    : false
            var title
            if (isSelf == true) {
                title = `:tickets: Your Active Bets`
            } else {
                title = `${userName}'s Active Bet Slips`
            }
            var joinedBetsArr = container[`listBets-${userid}`].join('\n───────\n')
            var embedcontent = {
                title: title,
                color: '#00FF00',
                description: joinedBetsArr,
                target: `reply`,
                thumbnail: `${process.env.sportLogo}`,
                footer: `The payout and profit numbers are potential values, as these games have yet to be completed.`,
            }
            await Log.Yellow(`Sending ${userid} their betslips - Embed`)
            await embedReply(message, embedcontent)
            //!SECTION
            Log.Green(
                `[listMyBets.js] Storing User (${userid}) collected Array of Bet Information.`,
            )
            delete container[`listBets-${userid}`]
            return
        })
        .catch((err) => {
            Log.Error(`[listMyBets.js] Error checking for active bet\n${err}`)
            QuickError(message, `You currently have no active bets`, true)
            return false
        })
        .finally(() => {
            //? Clearing the array from memory to preserve our memory usage

            return
        })
}
