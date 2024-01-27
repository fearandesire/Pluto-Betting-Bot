import { server_ID } from '@pluto-server-config'
import { SapDiscClient } from '@pluto-core'

export default async function locateChannel(
	channelName,
	getChan,
) {
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
	if (getChan) {
		return gameChan
	}
	return true
}
