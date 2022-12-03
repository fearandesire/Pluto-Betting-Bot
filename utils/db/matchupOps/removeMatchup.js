import { Log, LIVEMATCHUPS } from '#config'
import { db } from '#db'
import { dmMe } from '../../bot_res/dmMe.js'
import { removeMatchLog } from '../../logging.js'

/**
 * @module removeMatch
 * Remove a matchup from the database
 * @param {integer} matchId - The match Id to remove from the database
 */

export async function removeMatch(hTeam, aTeam) {
    try {
        await db.none(
            `DELETE FROM "${LIVEMATCHUPS}" WHERE teamone = $1 AND teamtwo = $2`,
            [hTeam, aTeam],
        )
        Log.Green(
            `Successfully removed matchup ${hTeam} vs ${aTeam} from the database`,
        )
        removeMatchLog.info(
            `Successfully removed matchup ${hTeam} vs ${aTeam} from the database`,
        )
        return true
    } catch (err) {
        Log.Red(
            `Error occured removing matchup ${hTeam} vs ${aTeam} from the database`,
        )
        await dmMe(
            `Error occured removing matchup ${hTeam} vs ${aTeam} from the database`,
        )
        return false
    }
}
