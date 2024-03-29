import { SapDiscClient } from '@pluto-core'

/**
 * @module fetchChanId
 * Retrieve a channel Id from .env via the name specified
 * @param {string} reqId - The requested channel Id to retrieve
 * @return {object} Returns the Discord Channel Object with the Id specified
 */

export async function fetchChanId(reqId) {
	return new Promise((resolve, reject) => {
		// debug: console.log(`FETCHING ${reqId}`)
		const ID = process.env[`${reqId}`]
		const reqChan = SapDiscClient.channels.fetch(ID)
		resolve(reqChan)
	})
}
