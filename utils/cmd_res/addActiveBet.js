import { CmdRunning } from '../bot_res/classes/RunCmd.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

//? Add user Bet Slip into DB as JSONB (Binary JSON)
export function addActiveBet(betslip) {
	//? betslip object should be structured as follows: { userID: '⁡⁣⁣⁢𝙣⁡', betdata: [{ amount: '⁡⁣⁣⁢𝘯⁡', teamID: '⁡⁣⁣⁢𝘯⁡', matchID: '⁡⁣⁣⁢𝘯⁡', betID: '⁡⁣⁣⁢𝙣⁡' }] }
	new CmdRunning('addActiveBet')
	//? insert betslip JSON into PostgreSQL JSONB column
	db.oneOrNone('INSERT INTO activebets (betjson) VALUES ($1)', [betslip])
		.then((data) => {
			Log.Green(`[addActiveBet.js] Successfully added bet to activebets table`)
			//Log.BrightBlue(`[addActiveBet.js] Data: ${data}`)
		})
		.catch((err) => {
			Log.Error(
				`[addActiveBet.js] Error adding bet to activebets table\n${err}`,
			)
		})
}
