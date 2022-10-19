import { formatISO, isAfter } from 'date-fns'

import { db } from '#db'

/**
 * @module gameActive.js
 * 1. Query DB to locate the matchup via the name of one of the teams, and the matchup ID.
 * 2. Check the time of the game, and compare it to the current time.
 * 3. If the game has already started, return true. Otherwise, return false
 * @param {string} teamid - The team name to search for in the DB
 * @param {integer} matchupId - The matchup ID to search for in the DB
 * @returns {boolean} - True if the game has already started, false if it has not.
 */

export async function gameActive(teamName, matchupId) {
    var searchForActive = await db
        .oneOrNone(
            `SELECT * FROM "NBAactivematchups" WHERE "teamone" = $1 OR "teamtwo" = $1 AND "matchid" = $2`,
            [teamName, matchupId],
        )
        .then((dbMatchup) => {
            var gameStart = dbMatchup.startTime
            var today = new Date()
            var todayISO = formatISO(today, { representation: 'complete' })
            var startedOrNot = isAfter(todayISO, gameStart)
            if (startedOrNot) {
                return true
            } else {
                return false
            }
        })
    return searchForActive
}
