import { Log, NBA_ACTIVEMATCHUPS } from '#config'

import { db } from '#db'
import { resolveMatchupLog } from '../logging.js'

/**
 * @module resolveMatchup
 * Return matchup information from the database via the team's name
 * @param {string} teamName - The team name to search for.
 * @param {string} reqInfo - The information to return from the database about the matchup.
 * @returns {object | string} - Returns the matchup information from the database, or specific information requested, e.g, odds
 */

export async function resolveMatchup(teamName, reqInfo) {
	resolveMatchupLog.info(`Searching for: ${teamName} in db`)
	Log.Blue(`Searching for: ${teamName} in db`)
	var dbMatchup = await db.manyOrNone(
		`SELECT * FROM ${NBA_ACTIVEMATCHUPS} WHERE teamone = '${teamName}' OR teamtwo = '${teamName}'`,
	)
	if (!dbMatchup || Object.keys(dbMatchup).length === 0) {
		resolveMatchupLog.info(`No match found for: ${teamName}`)
		return false
	}
	if (!reqInfo) {
		return dbMatchup[0]
	} else if (reqInfo === 'odds') {
		if (teamName === dbMatchup[0].teamone) {
			return dbMatchup[0].teamoneodds
		} else if (teamName === dbMatchup[0].teamtwo) {
			return dbMatchup[0].teamtwoodds
		}
	}
}
