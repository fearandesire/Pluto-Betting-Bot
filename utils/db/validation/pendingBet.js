import { db } from '#db'
import { PENDING } from '#config'

/**
 * Handle queries to the database regarding pending bets. Note: 'pending bets' here indicate that the user is in the process of closing a bet.
 * This is to prevent the user from fooling the system and duplicating money.
 * - Places a user into pending bets
 * - Checks if a user exists in pending bets
 */

export default class PendingBetHandler {
	static async checkPending(userid) {
		return db.oneOrNone(
			`SELECT * FROM "${PENDING}" WHERE userid = $1`,
			[userid],
		)
	}

	static async insertPending(userid) {
		return db.none(
			`INSERT INTO "${PENDING}" (userid) VALUES ($1)`,
			[userid],
		)
	}

	static async deletePending(userid) {
		return db.none(
			`DELETE FROM "${PENDING}" WHERE userid = $1`,
			[userid],
		)
	}
}
