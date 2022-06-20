import { Log } from './send_functions/consoleLog.js'

//? Util functions to generate unique IDs
export function AssignBetID() {
	const id = Math.floor(Math.random() * 100000000)
	Log.BrightBlue(`[AssignID.js] Assigned Bet ID: ${id}`)
	return id
}
AssignBetID()
