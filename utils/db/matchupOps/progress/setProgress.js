import { db } from '#db'
import { LIVEMATCHUPS } from '#config'

/**
 * @module setProgress
 * @summary Query DB and set the 'inprogress' column to true to indicate that the matchup is in the process of being closed
 */

export async function setProgress(homeTeam, awayTeam) {
    var setInProg = await db.none(
        `
  UPDATE "${LIVEMATCHUPS}" SET inprogress = true WHERE teamone = $1 OR teamtwo = $2
  `,
        [homeTeam, awayTeam],
    )
    return setInProg
}
