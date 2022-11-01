import { Log } from '#config'
import { SapDiscClient } from '#main'

/**
 * @module locateChannel
 * Locate the game channel via the name
 * @param {string} channelName - The name of the channel to locate
 * @returns {object} - The channel object, or false if not found
 */

export async function locateChannel(channelName) {
	console.log(`Locating channel ${channelName.toLowerCase()}`)
	const guild = SapDiscClient.guilds.cache.get(`${process.env.server_ID}`)
	const category = guild.channels.cache.get(`${process.env.gameCat_ID}`)
	//# Locate the channel by name in the category
	var gameChan = guild.channels.cache.find(
		(gameChan) => gameChan.name.toLowerCase() === channelName.toLowerCase(),
	)
	if (!gameChan) {
		await Log.Red(
			`Unable to locate channel ${channelName} to delete.`,
			`#ff0000`,
		)
		return false
	} else {
		console.log(`Located channel ${gameChan.name} | ${gameChan.id}`)
		return gameChan
	}
}
