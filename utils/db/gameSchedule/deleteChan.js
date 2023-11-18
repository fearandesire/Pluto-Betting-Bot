import { Log } from '#config'
import locateChannel from '../../bot_res/locateChan.js'

/**
 * @module deleteChan
 * Locate the game channel via the name and delete it
 * @param {string} channelName - The name of the channel to locate
 * @returns {object} - The channel object, or false if not found
 */

export async function deleteChan(channelName) {
	// Replace spaces with -
	const parsedChanName = channelName.replace(/\s/g, '-')
	const gameChan = await locateChannel(parsedChanName, true)
	if (!gameChan) {
		await Log.Red(
			`Unable to locate channel ${parsedChanName} to delete.`,
			`#ff0000`,
		)
		return false
	}
	await gameChan.delete()
	return true
}
