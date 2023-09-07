import { db } from '#db'
import { CURRENCY } from '#config'

/**
 * @module reqLeaderboard
 * Pull and map all data from the currency/profile table in the DB - sort by the highest values to the lowest.
 */

export async function reqLeaderboard() {
	return db.map(
		`SELECT userid,balance FROM "${CURRENCY}" ORDER BY balance DESC NULLS LAST`,
		['123'],
		(lbObj) => lbObj,
	)
}
