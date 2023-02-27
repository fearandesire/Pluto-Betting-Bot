/** @module listMyBets */

import stringifyObject from 'stringify-object'
import {
	accounting,
	container,
	embedReply,
	QuickError,
	BETSLIPS,
} from '#config'

import { FileRunning } from '#botClasses/FileRunning'
import { Log } from '#LogColor'
import { db } from '#db'

/**
 * @module listMyBets
 * Query the database for all bets placed by the user
 * @param {integer} userid - The user's Discord ID
 * @param {obj} message - The Duscord message object
 *
 *
 */
export function listMyBets(userid, message) {
	container[`listBets-${userid}`] = []
	new FileRunning('listMyBets')
	db.map(
		`SELECT * FROM "${BETSLIPS}" WHERE userid = $1`,
		[userid],
		async (row) => {
			let { amount } = row
			const teamId = row.teamid
			const betId = row.betid
			const result = row.betresult
			if (
				row === null ||
				row.length === 0 ||
				row.length < 1 ||
				row === undefined
			) {
				return
			}
			if (result.toLowerCase() === 'pending') {
				Log.Red(`Pending bet found for user ${userid}`)
				Log.Green(
					`[listMyBets.js] Bets Collected for ${userid}:\n${stringifyObject(
						row,
					)}`,
				)
				const { format } = accounting
				amount = format(amount)
				const profit = format(row.profit) ?? `N/A`
				const payout = format(row.payout) ?? `N/A`
				container[`listBets-${userid}`].push(
					`**•** __Bet #${betId}__
            Team: **${teamId}** | Amount: \`$${amount}\`
            Profit: \`$${profit}\` | Payout: \`$${payout}\``,
				)
			} else {
				Log.Red(`Something went wrong when listing bets for user ${userid}`)
			}
		},
	)
		.then(async () => {
			await Log.Green(
				`[listMyBets.js] Collected User (${userid}) Bet Information [Memory - Stage 2]:`,
			)
			await Log.BrightBlue(container[`listBets-${userid}`])
			const userName = message?.author?.username
				? message?.author?.username
				: message?.user?.id
			const isSelf =
				message?.author?.id === userid ? true : message?.user?.id === userid
			let title
			if (isSelf === true) {
				title = `:tickets: Your Active Bets`
			} else {
				title = `${userName}'s Active Bet Slips`
			}
			const joinedBetsArr = container[`listBets-${userid}`].join('\n───────\n')
			const embedcontent = {
				title,
				color: '#00FF00',
				description: joinedBetsArr,
				target: `reply`,
				thumbnail: `${process.env.sportLogo}`,
				footer: `The payout and profit numbers are potential values, as these games have yet to be completed.`,
			}
			await Log.Yellow(`Sending ${userid} their betslips - Embed`)
			await embedReply(message, embedcontent)
			//! SECTION
			Log.Green(
				`[listMyBets.js] Storing User (${userid}) collected Array of Bet Information.`,
			)
			delete container[`listBets-${userid}`]
		})
		.catch((err) => {
			Log.Error(`[listMyBets.js] Error checking for active bet\n${err}`)
			QuickError(message, `You currently have no active bets`, true)
			return false
		})
		.finally(() => {})
}
