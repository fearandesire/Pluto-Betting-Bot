import { SapDiscClient } from '#main'

/**
 * @module isInServer
 * Check if a user is in the server
 *
 */

export async function isInServer(userid) {
    const server = await SapDiscClient.guilds.cache.get(
        `${process.env.server_ID}`,
    )
    var findCache = await server.members.fetch().then((members) => {
        var member = server.members.cache.get(`${userid}`)
        if (member == undefined) {
            console.log(`User ${userid} not found in server`)
            return false
        } else {
            console.log(`User ${userid} found in server`)
            return true
        }
    })
    return findCache
}
