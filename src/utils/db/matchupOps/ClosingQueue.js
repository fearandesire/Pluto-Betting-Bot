import { LIVEMATCHUPS } from '@pluto-server-config'

/**
 * Checks & sets matchups to be in the process of bets for matchups being processed.
 */
export default class ClosingQueue {
	async setProgress(id, dbCnx) {
		const set = await dbCnx.none(
			`
	  UPDATE "${LIVEMATCHUPS}" SET inprogress = true WHERE id = $1
	  `,
			[id],
		)
		if (!set) {
			return false
		}
		return true
	}

	async inProgress(id, dbCnx) {
		const match = await dbCnx.oneOrNone(
			` SELECT * FROM "${LIVEMATCHUPS}" WHERE id = $1`,
			[id],
		)
		return match?.inprogress || false
	}
}
