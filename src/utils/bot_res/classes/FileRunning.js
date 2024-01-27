// ? Utility Class to console log when a new command is being run

import { Log } from '@pluto-internal-logger'

export class FileRunning {
	constructor(cmdname) {
		this.cmdname = cmdname
		Log.Border()
		Log.Yellow(`[${this.cmdname}.js] is now running!`)
	}
}
