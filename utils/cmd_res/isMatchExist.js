import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

//? Verify the match & team selected to bet on are available

export function isMatchExist(teamid) {
	//? Check if teamid & matchid exist in the database
	return db
		.oneOrNone(
			`SELECT matchid FROM activematchups WHERE teamone = $1 OR teamtwo = $1`,
			[teamid],
		)
		.then((data) => {
			if (data) {
				var matchid = data.matchid
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
