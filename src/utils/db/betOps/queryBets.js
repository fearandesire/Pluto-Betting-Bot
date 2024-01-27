import db from '@pluto-db'
import {
	QuickError,
	embedReply,
	CURRENCY,
	BETSLIPS,
	LIVEBETS,
} from '@pluto-core-config'

import { guildImgURL } from '@pluto-embed-reply'
import { Log } from '@pluto-internal-logger'

/**
 * @module queryBets -
 * Query the DB and delete the specified bet via the betid
 * @param {integer} userid - The user's Discord ID
 * @param {integer} betid - The id of the bet to be deleted
 */
export async function queryBets(
	interaction,
	userid,
	betid,
) {
	db.tx('queryCancelBet', async (t) => {
		const getBetCount = await t.manyOrNone(
			`SELECT count(*) FROM "${BETSLIPS}" WHERE userid = $1`,
			[userid],
			(c) => c.count,
		)
		const betCount = Number(getBetCount[0].count) // ? convert count of bets to integer
		if (betCount < 1) {
			await QuickError(
				interaction,
				`You have no active bets to cancel.`,
			)
			throw Log.Error(
				`[queryBets.js] User ${userid} has no active bets.`,
			)
		}
		if (betCount > 0) {
			// Collect bet info
			const betData = await t.oneOrNone(
				`SELECT amount FROM "${BETSLIPS}" WHERE userid = $1 AND betid = $2`,
				[userid, betid],
			)
			// Collect current user balance
			const userBal = await t.oneOrNone(
				`SELECT balance FROM "${CURRENCY}" WHERE userid = $1`,
				[userid],
			)
			// add current user balance + the bet amount
			const newBal =
				Number(userBal.balance) +
				Number(betData.amount)
			await t.batch([
				await t.oneOrNone(
					`UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2`,
					[newBal, userid],
				),
				await t.oneOrNone(
					`DELETE FROM "${LIVEBETS}" WHERE userid = $1 AND betid = $2`,
					[userid, betid],
				),
				await t.oneOrNone(
					`DELETE FROM "${BETSLIPS}" WHERE userid = $1 AND betid = $2`,
					[userid, betid],
				),
			])
			const embObj = {
				title: `Bet Revoked`,
				description: `Successfully cancelled bet #${betid}\nYour balance has been restored.`,
				color: `#00ff00`,
				thumbnail: `${guildImgURL(
					interaction.client,
				)}`,
				target: `reply`,
			}
			await embedReply(interaction, embObj)
		}
	}).then((data) => {
		Log.Green(
			`[queryBets.js] Operations for ${userid} completed.`,
		)
		return data
	})
}
