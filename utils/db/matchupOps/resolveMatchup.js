import db from '@pluto-db'
import { LIVEMATCHUPS } from '@pluto-core-config'

/**
 * @module resolveMatchup
 * Return matchup information from the database via the team's name
 * @param {string} teamName - The team name to search for.
 * @param {string} reqInfo - The information to return from the database about the matchup.
 * @returns {object | string} - Returns the matchup information from the database, or specific information requested, e.g, odds
 */

export default async function resolveMatchup(
	teamName,
	reqInfo,
) {
	const dbMatchup = await db.manyOrNone(
		`SELECT * FROM "${LIVEMATCHUPS}" WHERE teamone = '${teamName}' OR teamtwo = '${teamName}'`,
	)
	if (!dbMatchup || Object.keys(dbMatchup).length === 0) {
		return false
	}
	if (!reqInfo) {
		return dbMatchup[0]
	}
	if (reqInfo === 'odds') {
		if (teamName === dbMatchup[0].teamone) {
			return dbMatchup[0].teamoneodds
		}
		if (teamName === dbMatchup[0].teamtwo) {
			return dbMatchup[0].teamtwoodds
		}
	}
	if (reqInfo === 'id') {
		return dbMatchup[0].id
	}
}
