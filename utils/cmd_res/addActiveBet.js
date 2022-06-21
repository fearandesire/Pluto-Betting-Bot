import { CmdRunning } from '../bot_res/classes/RunCmd.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

//? Add user Bet Slip into DB as JSONB (Binary JSON)
export function addActiveBet(betslip) {
	//? betslip object should be structured as follows: { userid: '⁡⁣⁣⁢𝙣⁡', betdata: [{ amount: '⁡⁣⁣⁢𝘯⁡', teamid: '⁡⁣⁣⁢𝘯⁡', matchid: '⁡⁣⁣⁢𝘯⁡', betid: '⁡⁣⁣⁢𝙣⁡' }] }
	new CmdRunning('addActiveBet')
	//? insert betslip JSON into PostgreSQL JSONB column
	db.none(
		'INSERT INTO activebets (userid, teamid, betid, amount) VALUES ($1, $2, $3, $4)',
		[betslip.userid, betslip.teamid, betslip.betid, betslip.amount],
	)
		.then(() => {
			Log.Green(`[addActiveBet.js] Successfully added bet to activebets table`)
		})
		.catch((err) => {
			Log.Error(
				`[addActiveBet.js] Error adding bet to activebets table\n${err}`,
			)
		})
}
