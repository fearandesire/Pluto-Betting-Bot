import db from '@pluto-db'
import {
	QuickError,
	_,
	accounting,
	BETSLIPS,
} from '@pluto-core-config'

import { embedReply } from '@pluto-embed-reply'
import PlutoLogger from '@pluto-logger'
import embedColors from '../../lib/colorsConfig.js'

/**
 * Fetch history of a users bets from the db table in the DB.
 * @param {object} interaction - The Discord Object message object
 * @param {integer} userid - The user id of the user who's bet history is being requested.
 * @return {object} - Embed object of user bet history
 */

export async function fetchBetHistory(
	interaction,
	userid,
	interactionEph,
) {
	let entries
	let wonCount = 0
	let lostCount = 0
	const betHistory = []
	await db
		.tx('fetchBetHistory', async (t) => {
			const findings = await t.manyOrNone(
				`SELECT * FROM "${BETSLIPS}" WHERE userid = $1 AND betresult <> 'pending' ORDER BY dateofbet`,
				[userid],
			)
			if (!findings || _.isEmpty(findings)) {
				QuickError(
					interaction,
					`You have no betting history to view.\nIf you currently have pending bets, they will not appear here until the matchup is finished.`,
				)
				return false
			}
			// # Count # of entries
			if (findings) {
				entries = Object.keys(findings).length
				for await (const i of Object.keys(
					findings,
				)) {
					const { format } = accounting
					const amount = format(
						findings[i].amount,
					)
					const profit = format(
						findings[i].profit,
					)
					const payout = format(
						findings[i].payout,
					)
					if (findings[i].betresult === `won`) {
						wonCount += 1
						await betHistory.push({
							name: `${findings[i].dateofbet} :white_check_mark: `,
							value: `**Team:** ${findings[i].teamid}\n**Bet Amount:**\`${amount}\`\n:moneybag: **Profit:** \`$${profit}\`\n:moneybag: **Payout:** \`$${payout}\``,
							inline: true,
						})
					} else if (
						findings[i].betresult === 'lost'
					) {
						lostCount += 1
						await betHistory.push({
							name: `:x: ${findings[i].dateofbet}`,
							value: `**Team:** ${findings[i].teamid}\n**Bet Amount:** \`$${amount}\`\n:pensive: **Lost Bet, no payout.**`,
							inline: true,
						})
					}
				}
			}
		})
		.then(async (resp) => {
			if (resp === false) {
				return
			}
			const userName =
				interaction?.author?.username ||
				interaction?.user?.username
			const embedcontent = {
				title: `${userName}'s Bet History`,
				color: `${embedColors.PlutoBrightGreen}`,
				description: `Total Bets: \`${entries}\` | Won: \`${wonCount}\` | Lost: \`${lostCount}\``,
				fields: betHistory,
			}
			await embedReply(
				interaction,
				embedcontent,
				interactionEph,
			)
		})
		.catch(async (error) => {
			await PlutoLogger.log({
				id: 4,
				description: `An error occured when fetching user bet history *(User ID: ${userid})*\nError: \`${error.message}\``,
			})
		})
}
