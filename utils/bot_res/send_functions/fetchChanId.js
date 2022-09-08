import { SapDiscClient } from '#main'

/**
 * @module fetchChanId
 * Retrieve a channel Id from .env via the name specified
 * @param {string} reqId - The requested channel Id to retrieve
 * @return {object} Returns the Discord Channel Object with the Id specified
 */

export async function fetchChanId(reqId) {
    var ID = process.env[`${reqId}`]
    var reqChan = await SapDiscClient.channels.fetch(ID)
    return reqChan
}
