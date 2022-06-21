import { CmdRunning } from '../bot_res/classes/RunCmd.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'

export function addActiveBet(betslip) {
	// var newslip = {}
	// newslip.activebets['activelist'] = []
	// newslip.activebets['activelist'].push(betslip)
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
