import { Log } from '#config'
import { msgBotChan } from '#botUtil/msgBotChan'
/**
 * @class NoDataFound -
 * Class to handle errors when no data is found
 * @returns {Error} - Returns an error object to be sent to the console.
 */
export class NoDataFoundError extends Error {
    constructor(message, filename, errToSpam) {
        super(message)
        this.message = message
        this.name = 'No Data Found - File & Information'
        this.filename = filename
        this.errToSpam = errToSpam ? errToSpam : `no`
        Log.Error(
            `[${this.filename}] UNABLE TO RETRIEVE ANY DATA:\n${this.message}`,
        )
        if (this.errToSpam !== `no`) {
            msgBotChan(this.message, `error`)
        }
    }
}
