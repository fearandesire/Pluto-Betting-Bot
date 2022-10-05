import { db } from '#db'

/**
 * @module isMatchExist -
 * Query promise to the DB resolves to a single row if we find a match in the 'activematchups' table.
 * Finds the match by the team name ({@link teamid}) provided.
 * @param {string} teamid - The team name to search for in the DB
 * @returns {obj} [1] Row from the query, or null if no match is found
 * @references {@link setupBet.js} - This module is called from setupBet.js - a function that is used to process a new bet.
 */

export function isMatchExist(teamid) {
    return db.oneOrNone(
        `SELECT * FROM activematchups WHERE teamone = $1 OR teamtwo = $1`,
        [teamid],
    )
}
