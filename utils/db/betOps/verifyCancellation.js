import { LIVEBETS } from '@pluto-core-config'
import db from '@pluto-db'
import { gameActive } from '@pluto-date-utils/gameActive.js'

/**
 * @module verifyCancellation
 * Retrieve the team name (teamid) from the provided bet id and check if the game has started. Intended to prevent cancellation of a bet from a game that has already started.
 */

export async function verifyCancellation(userid, betId) {
	const bet = await db.oneOrNone(
		`SELECT * FROM "${LIVEBETS}" WHERE betid = $1 AND userid = $2`,
		[betId, userid],
	)
	const teamName = bet.teamid
	const gameStatus = await gameActive(teamName)
	if (gameStatus) {
		return true
	}
	return false
}
