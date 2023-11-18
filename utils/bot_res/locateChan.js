import { SapDiscClient } from '#main'
import { server_ID } from '#env'

export default async function locateChannel(channelName) {
	const guild = await SapDiscClient.guilds.cache.get(
		`${server_ID}`,
	)
	const gameChan = await guild.channels.cache.find(
		(GC) =>
			GC.name.toLowerCase() ===
			channelName.toLowerCase(),
	)
	if (!gameChan) {
		return false
	}
	return true
}
