import { db } from '#db'

/**
 * @module inProgress
 * Query DB for in-progress matchups [from the 'inprogress' column]
 */
export async function inProgress(teamone, teamtwo) {
    return await db.manyOrNone(
        `
  SELECT * FROM "NBAactivematchups" WHERE teamone = $1
  `,
        [teamone, teamtwo],
    )
}
