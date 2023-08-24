import { SapDiscClient } from '#main'
import { server_ID } from '#env'

export default async function locateChannel(channelName) {
    const guild = SapDiscClient.guilds.cache.get(
        `${server_ID}`,
    )
    const gameChan = guild.channels.cache.find(
        (GC) =>
            GC.name.toLowerCase() ===
            channelName.toLowerCase(),
    )
    return gameChan
}
