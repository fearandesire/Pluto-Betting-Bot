import { Log } from '#config'
import locateChannel from '../../bot_res/locateChan.js'

/**
 * @module deleteChan
 * Locate the game channel via the name and delete it
 * @param {string} channelName - The name of the channel to locate
 * @returns {object} - The channel object, or false if not found
 */

export async function deleteChan(channelName) {
    console.log(
        `Locating channel ${channelName.toLowerCase()}`,
    )
    const gameChan = await locateChannel(channelName)
    if (!gameChan) {
        await Log.Red(
            `Unable to locate channel ${channelName} to delete.`,
            `#ff0000`,
        )
        return false
    }
    console.log(
        `Located channel ${gameChan.name} | ${gameChan.id}`,
    )
    await gameChan.delete()
    return true
}
