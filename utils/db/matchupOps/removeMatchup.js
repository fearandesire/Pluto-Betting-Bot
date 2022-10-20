import { Log } from '#config'
import { db } from '#db'
import { removeMatchLog } from '../../logging.js'

/**
 * Remove a matchup from the database
 * @param {integer} matchId - The match Id to remove from the database
 */

export async function removeMatch(matchId) {
	try {
		await db.none('DELETE FROM "NBAactivematchups" WHERE matchid = $1', [
			matchId,
		])
		Log.Green(`Successfully removed ${matchId} from the database`)
		removeMatchLog.info(`Successfully removed ${matchId} from the database`)
		return true
	} catch (err) {
		Log.Red(`Error occured removing ${matchId} from the database.`)
		return false
	}
}
