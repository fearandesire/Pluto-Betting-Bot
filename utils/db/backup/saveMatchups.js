import { Log, _, flatcache } from '#config'

import { db } from '#db'

/**
 * @module saveMatchups - Save all matchups in the activematchups table from the DB to cache
 */

export async function saveMatchups() {
    db.manyOrNone('SELECT * FROM activematchups')
        .then((data) => {
            console.log(`Data from saveMatchups`, data)
            if (_.isEmpty(data)) {
                console.log(`No active matchups found in the database`)
                return false
            }
            //# activematchups Schema: matchid, teamone, teamtwo, teamoneodds, teamtwoodds, dateofmatchup
            var cache = flatcache.create('dbMatchups.json', './cache/dbMatchups')
            _.forEach(data, (matchup) => {
                const matchId = matchup.matchid
                const teamOne = matchup.teamone
                const teamTwo = matchup.teamtwo
                const teamOneOdds = matchup.teamoneodds
                const teamTwoOdds = matchup.teamtwoodds
                const dateOfMatchup = matchup.dateofmatchup
                var matchupObj = {
                    [matchId]: {
                        teamOne: teamOne,
                        teamTwo: teamTwo,
                        teamOneOdds: teamOneOdds,
                        teamTwoOdds: teamTwoOdds,
                        dateOfMatchup: dateOfMatchup,
                    },
                }
                cache.setKey('matchups', matchupObj)
                cache.save(true)
            })
        })
        .catch((err) => {
            Log.Red(`Error from saveMatchups`, err)
            return false
        })
}
