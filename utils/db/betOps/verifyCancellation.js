import { db } from '#db'
import { gameActive } from '#dateUtil/gameActive'

/**
 * @module verifyCancellation
 * Retrieve the team name (teamid) from the provided bet id and check if the game has started. Intended to prevent cancellation of a bet from a game that has already started.
 */

export async function verifyCancellation(userid, betId) {
	var bet = await db.oneOrNone(
		`SELECT * FROM "NBAactivebets" WHERE betid = $1 AND userid = $2`,
		[betId, userid],
	)
	var teamName = bet.teamid
	var gameStatus = await gameActive(teamName)
	if (gameStatus) {
		return true
	} else {
		return false
	}
}
