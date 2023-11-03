import { db } from '#db'
import { LIVEMATCHUPS } from '#config'

/**
 * Checks & sets matchups to be in the process of bets for matchups being processed.
 */
export default class ClosingQueue {
	constructor(homeTeam, awayTeam) {
		this.homeTeam = homeTeam
		this.awayTeam = awayTeam
	}

	async setProgress(homeTeam, awayTeam) {
		const set = await db.none(
			`
	  UPDATE "${LIVEMATCHUPS}" SET inprogress = true WHERE teamone = $1 OR teamtwo = $2
	  `,
			[homeTeam, awayTeam],
		)
		if (!set) {
			return false
		}
		return true
	}

	async inProgress(homeTeam, awayTeam, id) {
		const match = await db.oneOrNone(
			` SELECT * FROM "${LIVEMATCHUPS}" WHERE id = $1`,
			[id],
		)
		return match?.inprogress || false
	}
}
