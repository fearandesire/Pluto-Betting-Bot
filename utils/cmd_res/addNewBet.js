import { CmdRunning } from '../bot_res/classes/RunCmd.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

//? Add user Bet Slip into DB as JSONB (Binary JSON)
export function addNewBet(betslip) {
	//? betslip object model: { userid: '⁡⁣⁣⁢𝙣⁡',  teamid: '⁡⁣⁣⁢𝘯⁡', betid: '⁡⁣⁣⁢𝘯⁡', amount: '⁡⁣⁣⁢𝘯⁡', matchid: '⁡⁣⁣⁢𝙣⁡'  }
	new CmdRunning('addNewBet')
	//? insert betslip JSON into PostgreSQL JSONB column
	db.tx('createNewBet', (t) => {
		return t
			.one(
				`SELECT matchid from activematchups WHERE teamone = $1 OR teamtwo = $1`,
				[betslip.teamid],
			)
			.then((data) => {
				return t.none(
					`INSERT INTO betslips (userid, teamid, betid, amount, matchid, hasactivebet) VALUES ($1, $2, $3, $4, $5, $6)`,
					[
						betslip.userid,
						betslip.teamid,
						betslip.betid,
						betslip.amount,
						data.matchid,
						'valid',
					],
				)
			})
			.then(() => {
				Log.Green(`[addNewBet.js] Successfully added bet to betslips table`)
			})
			.catch((err) => {
				Log.Error(`[addNewBet.js] Error adding bet to betslips table\n${err}`)
			})
	})
}
