import db from '@pluto-db'
import { LIVEMATCHUPS } from '@pluto-core-config'

/**
 * @module inProgress
 * Query DB to see if the matchup is in progress of being closed
 */
export async function inProgress(homeTeam, awayTeam) {
	return db.oneOrNone(
		`
    SELECT inprogress FROM "${LIVEMATCHUPS}" WHERE teamone = $1 OR teamtwo = $2
    `,
		[homeTeam, awayTeam],
	)
}
