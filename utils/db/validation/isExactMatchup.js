import { db } from '#db'

/**
 * @module isExactMatchup
 * Query the database to validate if the exact matchup is existing. The home and away teams inputted must match `teamone` and `teamtwo` in the database respectively.
 * Returns true if the matchup exists, false if it does not.
 */

export async function isExactMatchup(homeTeam, awayTeam, matchupDate) {
    var matchup = await db.manyOrNone(
        `SELECT * FROM "NBAactivematchups" WHERE "teamone" = $1 AND "teamtwo" = $2 AND "dateofmatchup" = $3`,
        [homeTeam, awayTeam, matchupDate],
    )
    if (matchup) {
        return true
    } else {
        return false
    }
}
