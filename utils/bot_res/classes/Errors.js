import { Log } from '../send_functions/consoleLog.js'

/**
 * @class NoDataFound -
 * Class to handle errors when no data is found
 * @returns {Error} - Returns an error object to be sent to the console.
 */
export class NoDataFoundError extends Error {
	constructor(message, filename) {
		super(message)
		this.message = message
		this.name = 'No Data Found - File & Information'
		this.filename = filename
		Log.Error(
			`[${this.filename}] UNABLE TO RETRIEVE ANY DATA:\n${this.message}`,
		)
	}
}
