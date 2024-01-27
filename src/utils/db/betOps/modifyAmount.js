import db from '@pluto-db'
import {
	CURRENCY,
	BETSLIPS,
	LIVEBETS,
} from '@pluto-core-config'
import { Log } from '@pluto-internal-logger'

/**
 * @module modifyAmount -
 * Submodule which will modify the amount of a bet in the DB to a new amount via the bet and user IDs.
 * @function allowCollection - Since the user is updating a betslip, we will need to allow them to collect the updated information if they wish to view all their bets.
 * We could also just update the Local Storage data with this information, but alas.
 * @param {integer} userid
 * @param {integer} betid
 * @param {integer} amount
 */

export function modifyAmount(
	interaction,
	userid,
	betid,
	amount,
) {
	db.tx('modifyAmount', async (t) => {
		const currentAmount = await t.oneOrNone(
			`SELECT amount FROM "${BETSLIPS}" WHERE userid = $1 AND betid = $2`,
			[userid, betid],
		)
		const userBal = await t.oneOrNone(
			`SELECT balance FROM "${CURRENCY}" WHERE userid = $1`,
			[userid],
		)
		const convertBetAmount = Number(
			currentAmount.amount,
		)
		const convertBal = Number(userBal.balance)
		const tempBal = convertBetAmount + convertBal
		const newBal = tempBal - amount
		await t.oneOrNone(
			`UPDATE "${CURRENCY}" SET balance = $1 WHERE userid = $2`,
			[newBal, userid],
		)
		await t.oneOrNone(
			`UPDATE "${BETSLIPS}" SET amount = $1 WHERE userid = $2 AND betid = $3`,
			[amount, userid, betid],
		)
		await t.oneOrNone(
			`UPDATE "${LIVEBETS}" SET amount = $1 WHERE userid = $2 AND betid = $3`,
			[amount, userid, betid],
		)
	}).then(() =>
		interaction.reply({
			content: `Successfully updated your bet *(#${betid})* amount to $${amount}.`,
			ephemeral: true,
		}),
	)
}
