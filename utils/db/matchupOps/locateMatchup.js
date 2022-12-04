import { Log, LIVEMATCHUPS } from '#config'
import { db } from '#db'
import { locateMatchupIdLog } from '../../logging.js'

export async function locateMatchup(hTeam, awTeam) {
    locateMatchupIdLog.info(
        `locateMatchup.js: Searching for matchup ${hTeam} vs ${awTeam}`,
    )
    return new Promise(async (resolve, reject) => {
        //# locate matchid that contains both teams
        var callMatchups = async () => {
            return db
                .many(`SELECT * FROM "${LIVEMATCHUPS}" WHERE teamone = $1`, [hTeam])
                .then((data) => {
                    console.log(`DATA`, data[0])
                    data = data[0]
                    var tOne = data.teamone
                    var tTwo = data.teamtwo
                    return {
                        [`teamone`]: tOne,
                        [`teamtwo`]: tTwo,
                        [`matchid`]: data.matchid,
                    }
                })
                .catch((err) => {
                    reject(err)
                })
        }
        await callMatchups()
            .then(async (matchup) => {
                let tOne = matchup?.teamone
                let tTwo = matchup?.teamtwo
                if (!tOne || !tTwo) {
                    Log.Red(
                        `locateMatchup.js: Unable to locate matchup / ID for ${hTeam} vs ${awTeam} in the database`,
                    )
                    locateMatchupIdLog.error(
                        `Unable to locate matchup / ID for ${hTeam} vs ${awTeam} in the database`,
                    )
                    reject(false)
                }
                locateMatchupIdLog.info(
                    `Home Team - ${hTeam} (${tOne}) Away Team - ${awTeam} (${tTwo})`,
                )
                if (tOne === hTeam && tTwo === awTeam) {
                    locateMatchupIdLog.info(`Matchup Found`)
                    resolve(matchup.matchid)
                } else {
                    reject(false)
                }
            })
            .catch((err) => {
                reject(err)
            })
    }).catch((err) => {
        Log.Red(`\nError: ${err}\n`)
        locateMatchupIdLog.error(`== Error: ==\n${err}\n`)
        return false
    })
}
