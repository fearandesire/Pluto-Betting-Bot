//? Utility Class to console log when a new command is being run

import { Log } from '../send_functions/consoleLog.js'

export class FileRunning {
	constructor(cmdname) {
		this.cmdname = cmdname
		Log.Border()
		Log.Yellow(`[${this.cmdname}.js] is now running!`)
	}
}
