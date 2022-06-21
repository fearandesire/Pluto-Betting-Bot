import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

//? Verify the match & team selected to bet on are available

export function isMatchExist(teamid, matchid) {
	//? Check if teamid & matchid exist in the database
	return db
		.oneOrNone(
			`SELECT * FROM activematchups WHERE teamone = $1 AND matchid = $2 OR teamtwo = $1 AND matchid = $2`,
			[teamid, matchid],
		)
		.then((data) => {
			if (data) {
				Log.Green(`[isMatchExist.js] Match ${matchid} exists in the database`)
				return true
			} else {
				Log.Red(
					`[isMatchExist.js] Match ${matchid} does not exist in the database`,
				)
				return false
			}
		})
}
