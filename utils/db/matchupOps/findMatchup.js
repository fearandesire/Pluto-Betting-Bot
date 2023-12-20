import db from '@pluto-db'
import { LIVEMATCHUPS } from '@pluto-core-config'

/**
 * @module findMatchup
 * Locate the matchup in matchups table from the DB via searching for a matching team name
 * @param {string | integer} teamOrId - The team name or ID that we will search for
 * @return {obj} Returns the object of the row containing the matched team
 */

export function findMatchup(teamOrId) {
	console.log(
		`Searching for match containing: ${teamOrId}`,
	)
	if (typeof teamOrId === 'string') {
		return db.tx(
			'findMatchup',
			async (t) =>
				await t.oneOrNone(
					`SELECT * from "${LIVEMATCHUPS}" WHERE teamone = $1 OR teamtwo = $1`,
					[teamOrId],
				),
		)
	}
	if (typeof teamOrId === 'number') {
		return db.tx(
			'findMatchup',
			async (t) =>
				await t.oneOrNone(
					`SELECT * from "${LIVEMATCHUPS}" WHERE matchid = $1`,
					[teamOrId],
				),
		)
	}
}
