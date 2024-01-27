import db from '@pluto-db'
import { LIVEBETS, BETSLIPS } from '@pluto-core-config'
import { AssignBetID } from '@pluto-general-utils/AssignIDs'

/**
 * @module isBetIdExisting
 * Query DB to validate if the specific betid already exists. If so, create a new betid and assign a new one.
 * @param {integer} betId - The betid to validate
 */

export async function isBetIdExisting(betId) {
	return new Promise((resolve, reject) => {
		betId = Number(betId)
		const search = (betId) => {
			console.log(`Searching for betid: ${betId}`)
			db.tx(async (t) => {
				const activeBetsCheck = await t.oneOrNone(
					`SELECT * FROM "${LIVEBETS}" WHERE "betid" = $1`,
					[betId],
				)
				const betslipsCheck = await t.oneOrNone(
					`SELECT * FROM "${BETSLIPS}" WHERE "betid" = $1`,
					[betId],
				)
				// # recursively call the function if the betid already exists
				if (activeBetsCheck || betslipsCheck) {
					console.log(
						`BetID ${betId} already exists!`,
					)
					betId = await AssignBetID()
					return search(betId)
				}
				console.log(`BetID ${betId} is available!`)
				resolve(betId)
			})
		}
		search(betId)
	})
}
