import { db } from '#db'

/**
 * @module inProgress
 * Query DB to see if the matchup is in progress of being closed
 */
export async function inProgress(homeTeam, awayTeam) {
	return await db.oneOrNone(
		`
    SELECT inprogress FROM "activematchups" WHERE teamone = $1 OR teamtwo = $2
    `,
		[homeTeam, awayTeam],
	)
}
