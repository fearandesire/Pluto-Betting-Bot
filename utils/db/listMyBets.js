/** @module listMyBets */

import stringifyObject from 'stringify-object'
import _ from 'lodash'
import {
	accounting,
	container,
	embedReply,
	QuickError,
	BETSLIPS,
	LIVEBETS,
} from '#config'

import { Log } from '#LogColor'
import { db } from '#db'
import { SapDiscClient } from '#main'
import { guildImgURL } from '#embed'
import embedColors from '../../lib/colorsConfig.js'

/**
 * @module listMyBets
 * Query the database for all bets placed by the user
 * @param {integer} userid - The user's Discord ID
 * @param {obj} interaction - The Discord interaction object
 *
 *
 */
export async function listMyBets(userid, interaction) {
	const usersBetsArr = []
	try {
		const usersBets = await db.many(
			`SELECT * FROM "${BETSLIPS}" WHERE userid = $1`,
			[userid],
		)
		if (_.isEmpty(usersBets)) {
			await Log.Red(
				`User ${userid} does not have any bets.`,
			)
			throw new Error()
		}
		// # Remove any bet

		// Store information into array
		await _.forEach(usersBets, async (row) => {
			const { betresult } = row
			if (betresult !== `pending`) {
				return
			}
			let { amount } = row
			const teamId = row.teamid
			const betId = row.betid
			const { format } = accounting
			amount = format(amount)
			const profit = format(row.profit) ?? `N/A`
			const payout = format(row.payout) ?? `N/A`
			usersBetsArr.push(
				`**•** __Bet #${betId}__
            Team: **${teamId}** | Amount: \`$${amount}\`
            Profit: \`$${profit}\` | Payout: \`$${payout}\``,
			)
		})

		const betsJoined = usersBetsArr.join('\n───────\n')

		const userName = interaction?.author?.username
			? interaction?.author?.username
			: interaction?.user?.id
		const isSelf =
			interaction?.author?.id === userid
				? true
				: interaction?.user?.id === userid
		let title
		if (isSelf === true) {
			title = `:tickets: Your Active Bets`
		} else {
			title = `${userName}'s Active Bet Slips`
		}
		const embObj = {
			title,
			color: embedColors.PlutoGreen,
			description: betsJoined,
			target: `reply`,
			footer: `The payout and profit numbers are potential values, as these games have yet to be completed.`,
		}
		await embedReply(interaction, embObj)
	} catch (err) {
		Log.Error(
			`[listMyBets.js] Error checking for active bet\n${err}`,
		)
		console.log(err)
		QuickError(
			interaction,
			`You currently have no active bets`,
			true,
		)
		return false
	}
}
