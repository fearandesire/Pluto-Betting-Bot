import _ from 'lodash'
import { db } from '#db'
import { LIVEMATCHUPS } from "#config"
/**
 * @module isExactMatchup
 * Query the database to validate if the exact matchup is existing. The home and away teams inputted must match `teamone` and `teamtwo` in the database respectively.
 * Returns true if the matchup exists, false if it does not.
 * @param {string} homeTeam - The home team name to search for in the DB
 * @param {string} awayTeam - The away team name to search for in the DB
 * @param {string} matchupDate - The date of the matchup to search for in the DB
 * @returns {boolean} - True if the matchup exists, false if it does not.
 */

export async function isExactMatchup(homeTeam, awayTeam, matchupDate) {
    var matchup = await db.oneOrNone(
        `SELECT * FROM "${LIVEMATCHUPS}" WHERE "teamone" = $1 AND "teamtwo" = $2 AND "dateofmatchup" = $3`,
        [homeTeam, awayTeam, matchupDate],
    )
    if (_.isEmpty(matchup) === true) {
        return false
    } else {
        return true
    }
}
